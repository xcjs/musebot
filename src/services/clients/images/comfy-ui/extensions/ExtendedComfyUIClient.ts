import { ComfyUIClient, Prompt } from 'comfy-ui-client';
import WebSocket from 'ws';

import { ComfyUiMessage, ComfyUiMessageType } from './ComfyUiMessage.js';
import { MediaContainer, MultiMediaContainer, MultiMediaResponse, OutputMedia } from './MediaResponse.js';
import { SupportedNode } from './SupportedNode.js';

export class ExtendedComfyUIClient extends ComfyUIClient {
    async getMultiMedia(prompt: Prompt): Promise<MultiMediaResponse> {
        if (!this.ws) {
            throw new Error(
                'WebSocket client is not connected. Please call connect() before interacting.',
            );
        }

        const queue = await this.queuePrompt(prompt);
        const promptId = queue.prompt_id;

        return new Promise<MultiMediaResponse>((resolve, reject) => {
            const multiMediaResponse: MultiMediaResponse = {};

            const onMessage = async (data: WebSocket.RawData, isBinary: boolean) => {
                // Image previews are binary data.
                if (isBinary) {
                    return;
                }

                try {
                    const message = JSON.parse((data as Buffer).toString()) as ComfyUiMessage;

                    if (message.type === ComfyUiMessageType.Executing) {
                        const messageData = message.data;

                        if (messageData.node === null) {
                            // The workflow has completed.
                            if (messageData.prompt_id === promptId) {
                                const historyRes = await this.getHistory(promptId);
                                const history = historyRes[promptId];

                                for (const nodeId of Object.keys(history.outputs)) {
                                    const mediaContainer = history.outputs[nodeId] as MultiMediaContainer;

                                    for(const supportedNode of Object.values(SupportedNode)) {
                                        const outputMedia = mediaContainer[supportedNode.toString()] as OutputMedia[];

                                        if (outputMedia !== undefined) {
                                            const mediaContainers: MediaContainer[] = [];

                                            for (const media of outputMedia) {
                                                const blob = await this.getMedia(
                                                    media.filename,
                                                    media.subfolder,
                                                    media.type,
                                                );

                                                mediaContainers.push({
                                                    blob,
                                                    audio: supportedNode === SupportedNode.Audio ? media : undefined,
                                                    image: supportedNode === SupportedNode.Images ? media : undefined,
                                                });
                                            }

                                            multiMediaResponse[nodeId] = mediaContainers;
                                        }
                                    }
                                }

                                // Remove listener.
                                this.ws?.off('message', void onMessage);
                                return resolve(multiMediaResponse);
                            }
                        }
                    }
                } catch (error) {
                    const typedError = new Error(error as string);
                    return reject(typedError);
                }
            };

            // Add listener.
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            this.ws?.on('message', onMessage);
        });
    }

    async getMedia(
        filename: string,
        subfolder: string,
        type: string,
    ): Promise<Blob> {
        const res = await fetch(
            `http://${this.serverAddress}/view?` +
            new URLSearchParams({
                filename,
                subfolder,
                type,
            }).toString(),
        );

        const blob = await res.blob();
        return blob;
    }
}

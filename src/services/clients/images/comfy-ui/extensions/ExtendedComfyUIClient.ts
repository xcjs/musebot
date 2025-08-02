import { ComfyUIClient, Prompt } from 'comfy-ui-client';
import WebSocket from 'ws';

import { MediaContainer, MultiMediaContainer, MultiMediaResponse } from './MediaResponse.js';

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
                // Previews are binary data
                if (isBinary) {
                    return;
                }

                try {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-base-to-string
                    const message = JSON.parse(data.toString());

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (message.type === 'executing') {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        const messageData = message.data;

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        if (!messageData.node) {
                            // Execution is done
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            if (messageData.prompt_id === promptId) {
                                const historyRes = await this.getHistory(promptId);
                                const history = historyRes[promptId];

                                for (const nodeId of Object.keys(history.outputs)) {
                                    const mediaContainer = history.outputs[nodeId] as MultiMediaContainer;

                                    if (mediaContainer.audio !== undefined) {
                                        const audioOutputs: MediaContainer[] = [];

                                        for (const audio of mediaContainer.audio) {
                                            const blob = await this.getMedia(
                                                audio.filename,
                                                audio.subfolder,
                                                audio.type,
                                            );

                                            audioOutputs.push({
                                                blob,
                                                audio,
                                                image: undefined
                                            });
                                        }

                                        multiMediaResponse[nodeId] = audioOutputs;
                                    }
                                }

                                // Remove listener
                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                this.ws?.off('message', onMessage);
                                return resolve(multiMediaResponse);
                            }
                        }
                    }
                } catch (err) {
                    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                    return reject(err);
                }
            };

            // Add listener
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

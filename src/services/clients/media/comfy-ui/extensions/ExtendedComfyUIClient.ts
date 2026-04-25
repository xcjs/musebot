import { ComfyUIClient, Prompt } from 'comfy-ui-client';
import WebSocket from 'ws';

import { ContentType } from '../../../../../enums/ContentType.js';
import { HttpHeader } from '../../../../../enums/HttpHeader.js';
import { HttpMethod } from '../../../../../enums/HttpMethod.js';
import { IFreeMemoryRequest } from '../models/requests/IFreeMemoryRequest.js';
import { ComfyUiMessage, ComfyUiMessageType } from './ComfyUiMessage.js';
import { MediaCollectionResponse, MediaContainer, OutputMedia } from './MediaResponse.js';
import { SupportedNode } from './SupportedNode.js';

export class ExtendedComfyUIClient extends ComfyUIClient {
    readonly #baseUrl = `http://${this.serverAddress}/`;

    async getMultiMedia(prompt: Prompt): Promise<MediaCollectionResponse> {
        if (!this.ws) {
            throw new Error(
                'WebSocket client is not connected. Please call connect() before interacting.',
            );
        }

        const queue = await this.queuePrompt(prompt);
        const promptId = queue.prompt_id;

        return new Promise<MediaCollectionResponse>((resolve, reject) => {
            const multiMediaResponse: MediaCollectionResponse = {};

            const onMessage = async (data: WebSocket.RawData, isBinary: boolean): Promise<void> => {
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
                                    const mediaContainer = history.outputs[nodeId] as MediaContainer;

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
                                                    media: media,
                                                });
                                            }

                                            multiMediaResponse[nodeId] = mediaContainers;
                                        }
                                    }
                                }

                                // Remove listener.
                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                this.ws?.off('message', onMessage);

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
            `${this.#baseUrl}view?` +
            new URLSearchParams({
                filename,
                subfolder,
                type,
            }).toString(),
        );

        const blob = await res.blob();
        return blob;
    }

    async free(): Promise<void> {
        const requestBody: IFreeMemoryRequest = {
            unload_models: true,
            free_memory: true
        };

        await fetch(`${this.#baseUrl}free`, {
            method: HttpMethod.Post,
            headers: {
                [HttpHeader.ContentType]: ContentType.Json
            },
            body: JSON.stringify(requestBody)
        });
    }
}

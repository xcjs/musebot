import { ComfyUIClient, Prompt } from 'comfy-ui-client';
import WebSocket from 'ws';

import { AudioContainer, AudiosResponse } from './AudioResponse.js';

export class ExtendedComfyUIClient extends ComfyUIClient {
    async getAudios(prompt: Prompt): Promise<AudiosResponse> {
        if (!this.ws) {
            throw new Error(
                'WebSocket client is not connected. Please call connect() before interacting.',
            );
        }

        const queue = await this.queuePrompt(prompt);
        const promptId = queue.prompt_id;

        return new Promise<AudiosResponse>((resolve, reject) => {
            const outputAudios: AudiosResponse = {};

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
                                // Get history
                                const historyRes = await this.getHistory(promptId);
                                const history = historyRes[promptId];

                                // Populate output images
                                for (const nodeId of Object.keys(history.outputs)) {
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                    const nodeOutput = history.outputs[nodeId];
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                                    if (nodeOutput.audio) {
                                        const audioOutput: AudioContainer[] = [];
                                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                                        for (const audio of nodeOutput.audio) {
                                            const blob = await this.getAudio(
                                                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                                                audio.filename,
                                                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                                                audio.subfolder,
                                                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                                                audio.type,
                                            );

                                            audioOutput.push({
                                                blob,
                                                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                                audio,
                                            });
                                        }

                                        outputAudios[nodeId] = audioOutput;
                                    }
                                }

                                // Remove listener
                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                this.ws?.off('message', onMessage);
                                return resolve(outputAudios);
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

    async getAudio(
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

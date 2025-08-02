import { ImageContainer, OutputImage } from 'comfy-ui-client';

export interface MultiMediaResponse {
    [nodeId: string]: MediaContainer[];
}

export interface MediaResponse {
    [nodeId: string]: MediaContainer;
}

export interface MultiMediaContainer {
    audio: OutputMedia[];
    image: OutputMedia[];
}

export interface MediaContainer extends ImageContainer {
    audio: OutputMedia;
}

export type OutputMedia = OutputImage

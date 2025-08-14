import { ImageContainer, OutputImage } from 'comfy-ui-client';

export interface MediaCollectionResponse {
    [nodeId: string]: MediaContainer[];
}

export interface MediaResponse {
    [nodeId: string]: MediaContainer;
}

export interface MediaContainer {
    media: OutputMedia;
    blob: Blob;
}

export interface AudioContainer extends ImageContainer {
    audio: OutputMedia;
}

export type OutputMedia = OutputImage

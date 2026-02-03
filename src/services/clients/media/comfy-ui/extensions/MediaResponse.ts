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

export interface VideoContainer extends ImageContainer {
    format: string;
    frame_rate: number;
    fullpath: string;
    workflow: string;
}

export type OutputMedia = OutputImage

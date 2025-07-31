export interface AudiosResponse {
    [nodeId: string]: AudioContainer[];
}

export interface AudioResponse {
    [nodeId: string]: AudioContainer;
}

export interface AudioContainer {
    blob: Blob;
    audio: OutputAudio;
}

export interface OutputAudio {
    filename: string;
    subfolder: string;
    type: string;
}

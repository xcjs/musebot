export interface ComfyUiMessage {
    data: ComfyUiMessageData;
    type: ComfyUiMessageType
}

export interface ComfyUiMessageData {
    node: unknown;
    prompt_id: string;
}

export enum ComfyUiMessageType {
    CrysToolsMonitor = 'crystools.monitor',
    Executed = 'executed',
    Executing = 'executing',
    ExecutionSuccess = 'execution_success',
    Status = 'status'
}

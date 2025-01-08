export interface IGenerativeChatClient {
    id: string;
    name: string;
    login(): Promise<void>;
}

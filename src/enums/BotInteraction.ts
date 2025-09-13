export enum BotInteraction {
    // Chat Interactions
    Message = 'message',
    JsonMessage = 'jsonMessage',
    Reply = 'reply',
    Reaction = 'reaction',
    // LLM Button Interactions
    ClearContext = 'clearContext',
    ClearContextCancel = 'clearContextCancel',
    ClearContextConfirm = 'clearContextConfirm',
    // Media Button Interactions
    ExpandPrompt = 'expandPrompt',
    GuidanceScaleMinus = 'guidanceScaleMinus',
    GuidanceScalePlus = 'guidanceScalePlus',
    Help = 'help',
    Randomize = 'randomize',
    Retry = 'retry',
    ShowSource = 'showSource'
}

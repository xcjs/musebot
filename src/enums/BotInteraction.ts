export enum BotInteraction {
    // Chat Interactions
    Mention = 'mention',
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

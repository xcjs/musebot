import { IServiceContainer } from '../IServiceContainer.js';
import { IHelpService } from './IHelpService.js';

export class HelpService implements IHelpService {
    #services: IServiceContainer

    constructor(services: IServiceContainer) {

    }

    buildHelpArticle(): string {
        return '';
    }
}

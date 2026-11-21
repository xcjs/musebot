import { FormData as UndiciFormData } from 'undici';

/**
 * Installs musebot's undici `FormData` as the global `FormData`.
 *
 * Node.js builds its global `FormData` from its internal (older) undici,
 * while `@discordjs/rest`'s bundled older undici creates REST multipart
 * bodies from the global and dispatches them to the global dispatcher
 * slot. When musebot's newer undici supplies that legacy dispatcher
 * wrapper, its request construction brand-checks the body and rejects
 * foreign FormData with
 * `InvalidArgumentError: body must be a FormData created by this undici
 * package instance; FormData from other sources, such as the built-in
 * FormData provided by Node.js, is not supported`.
 *
 * Installing musebot's undici `FormData` as the global makes every
 * consumer create bodies from the brand that the dispatcher accepts,
 * regardless of module load order (plain node's internal undici
 * pre-seeds the legacy dispatcher slot, while parcel/pkg bundles load
 * this package's undici first).
 */
export function installUndiciFormDataGlobal(): void {
  (globalThis as { FormData: unknown }).FormData = UndiciFormData;
}

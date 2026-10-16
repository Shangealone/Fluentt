import type { Created, Profile } from "../services/api/identity";
export type Vault = {
  read(): Promise<string | null>;
  save(value: string): Promise<void>;
  clear(): Promise<void>;
};
export class SessionController {
  credential: string | null = null;
  pending: Created | null = null;
  busy = false;
  vault: Vault;
  constructor(vault: Vault) {
    this.vault = vault;
  }
  async restore(
    me: (credential: string) => Promise<Profile>,
  ): Promise<Profile | null> {
    const credential = await this.vault.read();
    if (!credential) return null;
    this.credential = credential;
    try {
      return await me(credential);
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        await this.vault.clear();
        this.credential = null;
        return null;
      }
      throw error;
    }
  }
  async create(issue: () => Promise<Created>): Promise<Profile> {
    if (this.busy) throw new Error("Please wait for the current request.");
    if (this.credential)
      throw new Error(
        "A device session already exists. Restore it before continuing.",
      );
    this.busy = true;
    try {
      // Retain issuance in memory if secure persistence fails; retry never creates a second profile.
      this.pending ??= await issue();
      await this.vault.save(this.pending.session.credential);
      this.credential = this.pending.session.credential;
      const profile = this.pending.user;
      this.pending = null;
      return profile;
    } finally {
      this.busy = false;
    }
  }
}

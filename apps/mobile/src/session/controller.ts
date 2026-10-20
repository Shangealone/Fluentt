import type { Created, Profile } from "../services/api/identity";
export type Vault = {
  read(): Promise<string | null>;
  save(value: string): Promise<void>;
  clear(): Promise<void>;
};
export class SessionChangedError extends Error {
  constructor() { super("The device session changed. Please retry from your current account."); }
}
export class SessionController {
  credential: string | null = null;
  pending: Created | null = null;
  busy = false;
  vault: Vault;
  revision = 0;
  blocked = false;
  private logoutSecret: string | null = null;
  private needsClear = false;
  constructor(vault: Vault) {
    this.vault = vault;
  }
  async restore(
    me: (credential: string) => Promise<Profile>,
  ): Promise<Profile | null> {
    if (this.logoutSecret) throw new Error("Finish signing out before restoring a session.");
    if (this.needsClear) { await this.clear(); return null; }
    const revision = ++this.revision;
    this.blocked = true;
    const credential = await this.vault.read();
    this.assertRevision(revision);
    this.credential = credential;
    if (!credential) { this.blocked = false; return null; }
    try {
      const profile = await me(credential);
      this.assertRevision(revision);
      this.blocked = false;
      return profile;
    } catch (error) {
      this.assertRevision(revision);
      if ((error as { status?: number }).status === 401) {
        await this.invalidate();
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
    if (this.blocked) throw new Error("Finish the device session check before creating a profile.");
    const revision = this.revision;
    this.busy = true;
    try {
      // Retain issuance in memory if secure persistence fails; retry never creates a second profile.
      this.pending ??= await issue();
      this.assertRevision(revision);
      await this.vault.save(this.pending.session.credential);
      this.assertRevision(revision);
      this.credential = this.pending.session.credential;
      const profile = this.pending.user;
      this.pending = null;
      return profile;
    } finally {
      this.busy = false;
    }
  }
  async login(issue: () => Promise<Created>): Promise<Profile> {
    if (this.busy) throw new Error("Please wait for the current request.");
    const revision = this.revision;
    this.busy = true;
    try {
      const issued = await issue();
      this.assertRevision(revision);
      await this.vault.save(issued.session.credential);
      this.assertRevision(revision);
      this.credential = issued.session.credential;
      this.pending = null;
      this.blocked = false;
      return issued.user;
    } finally {
      this.busy = false;
    }
  }
  private assertRevision(revision: number) {
    if (revision !== this.revision) throw new SessionChangedError();
  }
  async run<T>(operation: (credential: string) => Promise<T>): Promise<T> {
    if (this.blocked || !this.credential) throw new SessionChangedError();
    const revision = this.revision;
    const credential = this.credential;
    try {
      const result = await operation(credential);
      this.assertRevision(revision);
      if (this.blocked) throw new SessionChangedError();
      return result;
    } catch (error) {
      this.assertRevision(revision);
      throw error;
    }
  }
  async invalidate() {
    this.revision += 1;
    this.credential = null;
    this.pending = null;
    this.blocked = true;
    this.needsClear = true;
    await this.clear();
  }
  async clear() {
    await this.vault.clear();
    this.needsClear = false;
    this.blocked = false;
  }
  async logout(revoke: (credential: string) => Promise<void>) {
    if (this.busy) throw new Error("Please wait for the current request.");
    this.busy = true;
    this.logoutSecret ??= this.credential;
    this.revision += 1;
    this.blocked = true;
    try {
      if (this.logoutSecret) {
        try { await revoke(this.logoutSecret); }
        catch (error) {
          if ((error as { status?: number }).status !== 401) throw error;
        }
      }
      this.logoutSecret = null;
      this.credential = null;
      this.pending = null;
      this.needsClear = true;
      await this.clear();
    } finally { this.busy = false; }
  }
}

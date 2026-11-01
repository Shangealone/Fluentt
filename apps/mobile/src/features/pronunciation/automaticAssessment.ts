/** Arms one assessment per completed recording; failed requests retry explicitly. */
export class AutomaticAssessment {
  private armed = false;
  arm() { this.armed = true; }
  cancel() { this.armed = false; }
  consume(status: string, audio: unknown, consented: boolean): boolean {
    if (!this.armed || status !== "recorded" || !audio || !consented) return false;
    this.armed = false;
    return true;
  }
}

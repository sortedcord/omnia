export class WorldClock {
  private currentTime: Date;

  constructor(startTime: Date = new Date(1999, 4, 14, 18, 0)) {
    this.currentTime = startTime;
  }

  advance(minutes: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + minutes * 60_000);
  }

  get(): Date {
    return this.currentTime;
  }

  static fromISOString(iso: string): WorldClock {
    return new WorldClock(new Date(iso));
  }
}

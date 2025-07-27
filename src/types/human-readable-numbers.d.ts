declare module "human-readable-numbers" {
  interface HRNumbers {
    toHumanString(num: number): string;
  }

  const HRNumbers: HRNumbers;
  export = HRNumbers;
}

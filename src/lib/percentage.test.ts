import {
  convertPercentageToDecimal,
  convertProbabilityInputToDecimal,
  isPercentage,
} from "./percentage";

describe("isPercentage", () => {
  test("should detect a trailing % with optional whitespace", () => {
    expect(isPercentage("25%")).toBe(true);
    expect(isPercentage("  25 %  ")).toBe(true);
    expect(isPercentage("25")).toBe(false);
    expect(isPercentage("%25")).toBe(false);
    expect(isPercentage("")).toBe(false);
    expect(isPercentage(undefined)).toBe(false);
  });
});

describe("convertPercentage", () => {
  test("should convert percentage string to decimal", () => {
    expect(convertPercentageToDecimal("25%")).toEqual("0.25");
    expect(convertPercentageToDecimal("50%")).toEqual("0.5");
    expect(convertPercentageToDecimal("100%")).toEqual("1");
    expect(convertPercentageToDecimal("0%")).toEqual("0");
  });

  test("should handle percentages with decimal values", () => {
    expect(convertPercentageToDecimal("12.5%")).toEqual("0.125");
    expect(convertPercentageToDecimal("99.9%")).toEqual("0.999");
    expect(convertPercentageToDecimal("0.1%")).toEqual("0.001");
  });

  test("should handle percentages with whitespace", () => {
    expect(convertPercentageToDecimal("  25%  ")).toEqual("0.25");
    expect(convertPercentageToDecimal("50 %")).toEqual("0.5");
    expect(convertPercentageToDecimal("  100  %  ")).toEqual("1");
  });

  test("should return original string if not a percentage", () => {
    expect(convertPercentageToDecimal("25")).toEqual("25");
    expect(convertPercentageToDecimal("0.5")).toEqual("0.5");
    expect(convertPercentageToDecimal("abc")).toEqual("abc");
  });

  test("should handle undefined and empty string", () => {
    expect(convertPercentageToDecimal(undefined)).toEqual("");
    expect(convertPercentageToDecimal("")).toEqual("");
  });

  test("should handle invalid percentage values", () => {
    expect(convertPercentageToDecimal("abc%")).toEqual("abc%"); // NaN case, returns original
    expect(convertPercentageToDecimal("%")).toEqual("%"); // Empty before %
  });

  test("should handle negative percentages", () => {
    expect(convertPercentageToDecimal("-25%")).toEqual("-0.25");
    expect(convertPercentageToDecimal("-100%")).toEqual("-1");
  });

  test("should handle large percentage values", () => {
    expect(convertPercentageToDecimal("200%")).toEqual("2");
    expect(convertPercentageToDecimal("1000%")).toEqual("10");
  });
});

describe("convertProbabilityInputToDecimal", () => {
  test("should convert percentages to decimal", () => {
    expect(convertProbabilityInputToDecimal("25%")).toEqual("0.25");
    expect(convertProbabilityInputToDecimal("12.5 %")).toEqual("0.125");
  });

  test("should treat integers other than 1 as percentages", () => {
    expect(convertProbabilityInputToDecimal("25")).toEqual("0.25");
    expect(convertProbabilityInputToDecimal("100")).toEqual("1");
    expect(convertProbabilityInputToDecimal("0")).toEqual("0");
  });

  test("should keep 1 and decimals as is", () => {
    expect(convertProbabilityInputToDecimal("1")).toEqual("1");
    expect(convertProbabilityInputToDecimal("1.0")).toEqual("1.0");
    expect(convertProbabilityInputToDecimal("0.25")).toEqual("0.25");
  });

  test("should keep expressions and undefined as is", () => {
    expect(convertProbabilityInputToDecimal("p*2")).toEqual("p*2");
    expect(convertProbabilityInputToDecimal(undefined)).toBeUndefined();
  });
});

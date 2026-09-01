import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@app/test/render";
import { PasswordStrength, scoreOf } from "./password-strength";

describe("scoreOf", () => {
  it("counts each rule once, and nothing twice", () => {
    expect(scoreOf("")).toBe(0);
    expect(scoreOf("court")).toBe(0);
    expect(scoreOf("motdepasse")).toBe(1);
    expect(scoreOf("motdepasselong")).toBe(2);
    expect(scoreOf("MotDePasseLong")).toBe(3);
    expect(scoreOf("MotDePasseLong1")).toBe(4);
  });

  it("accepts a symbol as readily as a digit", () => {
    expect(scoreOf("MotDePasseLong!")).toBe(4);
  });

  it("reads accented case, since the copy is French", () => {
    // \p{Lu} rather than A-Z: "École" has an upper case letter.
    expect(scoreOf("Éclair12")).toBeGreaterThanOrEqual(3);
  });
});

describe("PasswordStrength", () => {
  it("shows nothing as met for an empty field", () => {
    renderWithIntl(<PasswordStrength password="" />);

    expect(screen.getByTestId("strength-label")).toHaveTextContent("Trop court");
    expect(document.querySelectorAll("li[data-met=true]")).toHaveLength(0);
  });

  it("names what is still missing rather than only grading", () => {
    renderWithIntl(<PasswordStrength password="motdepasse" />);

    // The unmet rules stay on screen: a score alone says nothing actionable.
    expect(screen.getByText("Des majuscules et des minuscules")).toBeInTheDocument();
    expect(screen.getByText("Un chiffre ou un symbole")).toBeInTheDocument();
    expect(document.querySelectorAll("li[data-met=true]")).toHaveLength(1);
  });

  it("marks every rule met once the password satisfies them all", () => {
    renderWithIntl(<PasswordStrength password="MotDePasseLong1" />);

    expect(screen.getByTestId("strength-label")).toHaveTextContent("Excellent");
    expect(document.querySelectorAll("li[data-met=true]")).toHaveLength(4);
  });
});

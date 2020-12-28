import { of } from "rxjs";
import { GroupControl, ItemControl } from "./controls";
import { AbstractHints } from "./controls.types";
import { FuzzyExecutableRegistry } from "./executable";
import { BasicVisitor, createConfigBuilder } from "./visitor";

type TestConfigs =
  | {
      type: "group";
      name?: string;
      fields: readonly TestConfigs[];
    }
  | { type: "text"; name: string }
  | { type: "checkbox"; name: string }
  | { type: "select"; name: string }
  | { type: "message" };

describe("#bundleConfig", () => {
  const registry = {
    hints: {
      static(config: TestConfigs, control: ItemControl, { value }: { value: boolean }) {
        return (c: ItemControl) => of(value);
      },
    },
  } as FuzzyExecutableRegistry;

  const visitor = new BasicVisitor<TestConfigs, typeof registry, AbstractHints, any>();
  const bundler = createConfigBuilder<TestConfigs, typeof registry, typeof visitor>(registry, visitor);

  test("item config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "message" }],
      hints: {
        skirts: [{ name: "static", params: { value: true } }],
      },
    } as const;
    const control = bundler<GroupControl<{}>>(config);
    expect(control).toBeTruthy();
    expect(control.children.length).toEqual(1);
    expect(control.children[0].children.length).toEqual(0);
  });

  test("basic field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }],
    } as const;
    const control = bundler<GroupControl<{ text: string | null }, any, any>>(config);
    expect(control).toBeTruthy();
    expect(control.children.length).toEqual(1);
    expect(control.children[0].children.length).toEqual(0);
    expect(control.value).toEqual({ text: null });
  });

  test("group config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    } as const;
    const control = bundler<GroupControl<{ text: string | null }, any, any>>(config);
    expect(control).toBeTruthy();
    expect(control.children.length).toEqual(2);
    expect(control.value).toEqual({ text: null });
  });

  test("group & field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    } as const;
    const control = bundler<GroupControl<{ text: string | null }, any, any>>(config);
    expect(control).toBeTruthy();
    expect(control.children.length).toEqual(2);
    expect(control.value).toEqual({ text: null });
  });

  test("nested group configs", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [
        { type: "text", name: "text" },
        { type: "message" },
        {
          type: "group",
          fields: [
            { type: "checkbox", name: "checkbox" },
            { type: "message" },
            { type: "group", name: "group", fields: [{ type: "select", name: "select" }] },
            { type: "group", fields: [{ type: "select", name: "select" }] },
          ],
        },
        {
          type: "group",
          fields: [{ type: "select", name: "select2" }],
        },
      ],
    } as const;
    const control = bundler<GroupControl<{ text: string; checkbox: boolean; group: { select: string } }, any, any>>(
      config,
    );
    expect(control).toBeTruthy();
    expect(control.children.length).toEqual(4);
    expect(control.children[2].children.length).toEqual(4);
    expect(control.children[2].children[2].children.length).toEqual(1);
    expect(control.value).toEqual({
      text: null,
      checkbox: null,
      group: { select: null },
      select: null,
      select2: null,
    });
  });
});

import { of } from "rxjs";
import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "./configs";
import { ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
import { AbstractExtras, AbstractHints } from "./controls.types";
import { BasicRegistry } from "./executable";
import { BaseFieldConfig } from "./primitives";
import { BasicVisitor, createConfigBuilder } from "./visitor";

type TestConfigs =
  | ({ type: "group" } & GroupConfig<any, BasicRegistry, AbstractHints, AbstractExtras, GroupControl<any>> &
      BaseFieldConfig)
  | ({ type: "array" } & ArrayConfig<any, BasicRegistry, AbstractHints, AbstractExtras, ArrayControl<any>>)
  | ({ type: "text" } & FieldConfig<BasicRegistry, AbstractHints, AbstractExtras, FieldControl<any>>)
  | ({ type: "checkbox" } & FieldConfig<BasicRegistry, AbstractHints, AbstractExtras, FieldControl<any>>)
  | ({ type: "select" } & FieldConfig<BasicRegistry, AbstractHints, AbstractExtras, FieldControl<any>>)
  | ({ type: "message" } & ItemConfig<BasicRegistry, AbstractHints, AbstractExtras, ItemControl>);

describe("#bundleConfig", () => {
  const visitor = new BasicVisitor<TestConfigs, BasicRegistry, AbstractHints, AbstractExtras>();
  const bundler = createConfigBuilder<TestConfigs, BasicRegistry, typeof visitor>(new BasicRegistry(), visitor);

  test("item config", () => {
    const config: TestConfigs = {
      type: "group",
      name: "group",
      fields: [{ type: "message" }],
      hints: {
        pants: [c => of(false)],
        skirts: [{ name: "static", params: { value: true } }],
      },
    };
    const control = bundler(config);
    expect(control).toBeTruthy();
    expect(control.children.length).toEqual(1);
    expect(control.children[0].children.length).toEqual(0);
    expect(control.hints).toEqual({ pants: false, skirts: true });
  });

  test("basic field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }],
    } as const;
    const control = bundler(config);
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
    const control = bundler(config);
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
    const control = bundler(config);
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
    const control = bundler(config);
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

  test("array config", () => {
    const config = {
      type: "array",
      name: "group",
      fields: {
        type: "group",
        name: "",
        fields: [{ type: "text", name: "text" }, { type: "message" }],
      },
    } as const;
    const control = bundler(config);
    control.reset([{ text: "pants" }]);
    expect(control).toBeTruthy();
    expect(control.children.length).toEqual(1);
    expect(control.value).toEqual([{ text: "pants" }]);
  });
});

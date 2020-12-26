import { of } from "rxjs";
import { GroupControl, ItemControl } from "./controls";
import { FuzzyExecutableRegistry } from "./executable";
import { ControlVisitor, createConfigBuilder } from "./visitor";

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

  const visitor = new ControlVisitor<TestConfigs, typeof registry>();
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
    const bundle = bundler<GroupControl<{}>>(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(1);
    expect(bundle.children[0].children.length).toEqual(0);
  });

  test("basic field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }],
    } as const;
    const bundle = bundler<
      GroupControl<{
        text: string | null;
      }>
    >(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(1);
    expect(bundle.children[0].children.length).toEqual(0);
    expect(bundle.control.value).toEqual({ text: null });
  });

  test("group config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    } as const;
    const bundle = bundler<GroupControl<{ text: string | null }>>(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(2);
    expect(bundle.control.value).toEqual({ text: null });
  });

  test("group & field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    } as const;
    const bundle = bundler<
      GroupControl<{
        text: string | null;
      }>
    >(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(2);
    expect(bundle.control.value).toEqual({ text: null });
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
          ],
        },
      ],
    } as const;
    const bundle = bundler<
      GroupControl<{
        text: string;
        checkbox: boolean;
        group: {
          select: string;
        };
      }>
    >(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(3);
    expect(bundle.children[2].children.length).toEqual(3);
    expect(bundle.children[2].children[2].children.length).toEqual(1);
    expect(bundle.control.value).toEqual({
      text: null,
      checkbox: null,
      group: { select: null },
    });
  });
});

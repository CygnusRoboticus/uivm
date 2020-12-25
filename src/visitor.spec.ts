import { of } from "rxjs";
import { ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
import { FuzzyExecutableRegistry } from "./executable";
import { ControlVisitor, createConfigBundler } from "./visitor";

describe("#bundleConfig", () => {
  const registry = {
    hints: {
      static(config: any, control: ItemControl, { value }: { value: boolean }) {
        return (c: ItemControl) => of(value);
      },
    },
  } as FuzzyExecutableRegistry;

  test("item config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "message" }],
      hints: {
        skirts: [{ name: "static", params: { value: true } }],
      },
    };
    const bundler = createConfigBundler<
      typeof config,
      typeof registry,
      ItemControl<any, any>,
      FieldControl<any, any, any>,
      GroupControl<any, any, any, any>,
      ArrayControl<any, any, any, any>
    >(registry, new ControlVisitor<typeof config, typeof registry, any, any>());
    const bundle = bundler<GroupControl<any, any, any, any>>(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(1);
    expect(bundle.children[0].children.length).toEqual(0);
  });

  test("basic field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }],
    };
    const bundler = createConfigBundler<
      typeof config,
      typeof registry,
      ItemControl<any, any>,
      FieldControl<any, any, any>,
      GroupControl<any, any, any, any>,
      ArrayControl<any, any, any, any>
    >(registry, new ControlVisitor<typeof config, typeof registry, any, any>());
    const bundle = bundler<GroupControl<any, any, any, any>>(config);
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
    };
    const bundler = createConfigBundler<
      typeof config,
      typeof registry,
      ItemControl<any, any>,
      FieldControl<any, any, any>,
      GroupControl<any, any, any, any>,
      ArrayControl<any, any, any, any>
    >(registry, new ControlVisitor<typeof config, typeof registry, any, any>());
    const bundle = bundler<GroupControl<any, any, any, any>>(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(2);
    expect(bundle.control.value).toEqual({ text: null });
  });

  test("group & field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    };
    const bundler = createConfigBundler<
      typeof config,
      typeof registry,
      ItemControl<any, any>,
      FieldControl<any, any, any>,
      GroupControl<any, any, any, any>,
      ArrayControl<any, any, any, any>
    >(registry, new ControlVisitor<typeof config, typeof registry, any, any>());
    const bundle = bundler<GroupControl<any, any, any, any>>(config);
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
    };
    const bundler = createConfigBundler<
      typeof config,
      typeof registry,
      ItemControl<any, any>,
      FieldControl<any, any, any>,
      GroupControl<any, any, any, any>,
      ArrayControl<any, any, any, any>
    >(registry, new ControlVisitor<typeof config, typeof registry, any, any>());
    const bundle = bundler<GroupControl<any, any, any, any>>(config);
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

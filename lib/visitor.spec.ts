import { ArrayControl, FieldControl, GroupControl } from "./controls";

describe("bundleConfig", () => {
  // it("happy path", () => {
  //   const fields = {
  //     type: "form",
  //     fields: [
  //       { type: "text", name: "text1" },
  //       { type: "group", name: "group", fields: [{ type: "text", name: "text2" }] },
  //     ],
  //   };
  //   const bundle = bundleConfig(fields);
  // });

  it("testing", () => {
    const asdf = new GroupControl({
      field1: new FieldControl("pants"),
      field2: new FieldControl("skirts"),
      group1: new GroupControl({
        field3: new FieldControl("shorts"),
      }),
      array1: new ArrayControl(
        (v: { groupField1: string | null } | null) =>
          new GroupControl({
            groupField1: new FieldControl(v?.groupField1 ?? null),
          }),
      ),
    });
    expect(asdf.value).toEqual({
      array1: [],
      field1: "pants",
      field2: "skirts",
      group1: {
        field3: "shorts",
      },
    });
    asdf.patchValue({ field1: "pants1", field2: "skirts2" });

    expect(asdf.value).toEqual({
      array1: [],
      field1: "pants1",
      field2: "skirts2",
      group1: {
        field3: "shorts",
      },
    });
    expect(asdf.value$.getValue()).toEqual({
      array1: [],
      field1: "pants1",
      field2: "skirts2",
      group1: {
        field3: "shorts",
      },
    });
  });
});

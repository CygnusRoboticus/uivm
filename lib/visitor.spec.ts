import { FieldControl, GroupControl } from "./asdf";

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
    const asdf = new GroupControl("form", [
      new FieldControl("field1", "pants"),
      new FieldControl("field2", "skirts"),
      new GroupControl("group1", [new FieldControl("field3", "shorts")]),
    ]);
    expect(asdf.value).toEqual({
      field1: "pants",
      field2: "skirts",
      group1: {
        field3: "shorts",
      },
    });
    asdf.patchValue({ field1: "pants1" });

    expect(asdf.value).toEqual({
      field1: "pants1",
      field2: "skirts",
      group1: {
        field3: "shorts",
      },
    });
    expect(asdf.value$.getValue()).toEqual({
      field1: "pants1",
      field2: "skirts",
      group1: {
        field3: "shorts",
      },
    });
  });
});

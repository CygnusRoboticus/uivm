import { BehaviorSubject } from "rxjs";
import { first, take } from "rxjs/operators";
import { ArrayControl, FieldControl, GroupControl, Messages } from "./controls";

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

  const createForm = () =>
    new GroupControl({
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
        [{ groupField1: <string | null>"shirts" }],
      ),
    });

  let form: ReturnType<typeof createForm>;

  beforeEach(() => {
    form = createForm();
  });

  test("value is updated", () => {
    expect(form.value).toEqual({
      array1: [{ groupField1: "shirts" }],
      field1: "pants",
      field2: "skirts",
      group1: {
        field3: "shorts",
      },
    });
    form.patchValue({ field1: "pants1", field2: "skirts2" });

    expect(form.value).toEqual({
      array1: [{ groupField1: "shirts" }],
      field1: "pants1",
      field2: "skirts2",
      group1: {
        field3: "shorts",
      },
    });
  });

  test("status bubbles upwards", () => {
    expect(form.status.dirty).toBeFalsy();
    form.controls.field1.setValue("pants3");
    expect(form.controls.field1.status.dirty).toBeTruthy();
    expect(form.status.dirty).toBeTruthy();
    expect(form.controls.array1.controls[0].status.dirty).toBeFalsy();
  });

  test("flags are set from executors", async () => {
    expect(await form.controls.field1.flags$.pipe(first()).toPromise()).toEqual({ hidden: false });
    form.controls.field1.setFlagExecutors([new BehaviorSubject<[string, boolean]>(["hidden", true])]);
    expect(await form.controls.field1.flags$.pipe(first()).toPromise()).toEqual({ hidden: true });
    expect(await form.flags$.pipe(first()).toPromise()).toEqual({ hidden: false });
  });

  test("messages are set from executors", async () => {
    expect(await form.controls.field1.messages$.pipe(first()).toPromise()).toEqual(null);
    form.controls.field1.setMessageExecutors([new BehaviorSubject<Messages | null>({ pants: { message: "skirts" } })]);
    expect(await form.controls.field1.messages$.pipe(first()).toPromise()).toEqual({ pants: { message: "skirts" } });
    expect(await form.messages$.pipe(first()).toPromise()).toEqual(null);
  });
});

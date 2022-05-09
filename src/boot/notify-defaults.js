import { boot } from "quasar/wrappers";
import { Notify } from "quasar";

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(async (/* { app, router, ... } */) => {
  Notify.setDefaults({
    position: "top-right",
    timeout: 3500,
    progress: true,
    textColor: "white",
    actions: [{ icon: "close", color: "white" }],
  });
});

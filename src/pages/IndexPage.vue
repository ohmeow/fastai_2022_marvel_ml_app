<template>
  <q-page class="flex justify-center items-start">
    <div class="q-pt-md">
      <!-- uploader -->
      <div class="row">
        <q-uploader
          ref="uploader"
          class="col-12"
          style="min-width: 400px; min-height: 400px"
          accept="image/*"
          :max-files="1"
          @added="fileAdded"
          @removed="fileRemoved"
        >
          <template v-slot:list="scope">
            <div v-if="scope.files.length == 0" class="flex flex-center nowrap uploader-nofile">
              <div>
                <q-icon color="accent" size="5rem">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 43">
                    <path
                      d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"
                    ></path>
                  </svg>
                </q-icon>
                <div class="text-h5">
                  <q-btn
                    style="color: #518cca"
                    dense
                    flat
                    rounded
                    size="1em"
                    padding="none"
                    no-caps
                    icon="image"
                    label="Choose an image"
                    @click="scope.pickFiles"
                  />
                  or drag it here
                </div>
                <div class="text-h5">
                  <q-btn style="color: #518cca" flat rounded size="1em" no-caps icon="camera" label="Take a pic" @click="takePicture()" />
                </div>
              </div>
            </div>
            <div
              v-else
              class="uploader-hasfile"
              :style="{
                'background-image': 'url(' + scope.files[0].__img.src + ')',
              }"
            >
              <div class="row flex-center no-wrap q-pa-sm uploader-hasfile-header">
                <div class="col">
                  <div class="text-weight-bold">{{ scope.files[0].name }}</div>
                  <div>
                    {{ scope.files[0].__sizeLabel }} /
                    {{ scope.files[0].__progressLabel }}
                  </div>
                </div>
                <div class="col-1">
                  <q-btn flat round icon="close" @click="scope.removeQueuedFiles" />
                </div>
              </div>
            </div>
          </template>
        </q-uploader>

        <q-btn
          class="col-12 q-mt-sm text-grey-1"
          style="background-color: #518cca"
          size="lg"
          icon-right="upload"
          :disabled="!hasFile"
          label="Predict Your Marvel Makeup"
          @click="predict"
        />
      </div>

      <!-- results -->
      <div v-if="predictionResults.length > 0" class="q-pa-xs">
        <div v-for="pred in predictionResults" :key="pred" class="row">
          <!-- prob-->
          <div class="col-12">
            <div class="col-12 text-h5 text-center">
              <div>Probability of Marvel ancestry</div>
              <div class="text-weight-bolder text-primary">{{ pred.is_marvel_character_prob }}</div>
            </div>
          </div>
          <!-- characters -->
          <div v-if="pred.marvel_character_probs.length > 0" class="col-12 q-pt-md">
            <div class="text-h5 text-center">Character Makeup</div>
            <div v-for="characterPred in pred.marvel_character_probs" :key="characterPred" class="row items-center q-pt-xs">
              <div class="col-2 text-center q-pr-xs text-weight-bold" style="font-size: 16px; text-transform: capitalize">
                {{ characterPred.label }}
              </div>
              <div class="col">
                <q-linear-progress size="50px" :value="characterPred.prob" color="#f78f3f">
                  <div class="absolute-full flex flex-center">
                    <q-badge color="white" text-color="secondary" :label="(characterPred.prob * 100).toFixed(2) + '%'" />
                  </div>
                </q-linear-progress>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from "vue";
import { QUploader, useQuasar } from "quasar";
import axios from "axios";
import { Camera, CameraResultType } from "@capacitor/camera";
import { decode, encode } from "base64-arraybuffer";
import moment from "moment";
import { computed } from "@vue/reactivity";

const $q = useQuasar();

const predictionResults = ref([]);
/** -----
 * Manage Base64 encoded versions of our uploaded file(s)
 */

const encodedFiles = ref([]);

const hasFile = computed(() => {
  return encodedFiles.value.length > 0;
});

const addToEncodedFiles = (reader) => {
  encodedFiles.value.push(reader.result);
};

const read = (file) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => addToEncodedFiles(reader));
  reader.readAsDataURL(file);
};

/** -----
 * QUploader configuration
 * Note: We are just using QUploader for its UX.  We will use the "predict()" method below to call into the Gradio API.
 */

// a ref to our QUploader
const uploader = ref();

// manage adding/removed base64 encoded files
const fileAdded = async (files) => {
  files.map(read);
};
const fileRemoved = async (files) => {
  encodedFiles.value = encodedFiles.value.filter((item) => files.includes(item));
  if (encodedFiles.value.length == 0) predictionResults.value = [];
};

/** -----
 * Camera configuration
 * Note: We have to grab as base64 and then create File object as we do below so that this will work on web
 *       as well as natively (see: https://stackoverflow.com/a/64788860/54818).
 */

async function takePicture() {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Base64,
  });

  const blob = new Blob([new Uint8Array(decode(image.base64String))], {
    type: `image/${image.format}`,
  });

  const file = new File([blob], "Snapshot", {
    lastModified: moment().unix(),
    type: blob.type,
  });

  uploader.value.addFiles([file]);
}

/** -----
 * Prediction / API calls
 */

const predict = async () => {
  predictionResults.value = [];

  $q.loading.show();

  for (const file of encodedFiles.value) {
    try {
      const formData = { data: [file] };

      // step 1: check if we even have a marvel character
      const { data: res } = await axios.post(
        "https://hf.space/embed/wgpubs/fastai_2022_session1_is_marvel_character/+/api/predict/",
        formData
      );
      const itemResults = { is_marvel_character_prob: res["data"][0], marvel_character_probs: [] };

      // step 2: if marvel character probability >- .5, then see makeup of top 3 characters
      if (parseFloat(itemResults.is_marvel_character_prob) >= 50) {
        const { data: res } = await axios.post(
          "https://notebookse.jarvislabs.ai/jY5fsv-S9jKoQQrgd1dsoJuCDt6pTg6ZjBpNK9afxLIGInQv4OlHVuTMHqOPh2LU/api/predict/",
          formData
        );

        for (const pred of res["data"][0]["confidences"]) {
          itemResults["marvel_character_probs"].push({ label: pred["label"], prob: pred["confidence"] });
        }

        console.log(itemResults);
        predictionResults.value.push(itemResults);
      }
    } catch (err) {
      $q.notify({ type: "negative", message: err.message || "Could not get prediction" });
    }
  }
  $q.loading.hide();
};
</script>

<style lang="scss">
.q-uploader__header {
  display: none;
}

.uploader-nofile {
  width: 100%;
  height: 340px;
  text-align: center;
}

.uploader-hasfile {
  width: 100%;
  height: 380px;
  background-position: 50% 50%;
  background-size: cover;
}

.uploader-hasfile-header {
  padding-bottom: 24px;
  color: $grey-1;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 20%, rgba(255, 255, 255, 0));
}
</style>

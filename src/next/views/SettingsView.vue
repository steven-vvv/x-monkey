<script setup lang="ts">
// 设置 tab: grouped cards over a draft (see useSettingsDraft). View contract: see NextApp.vue.
import { computed } from 'vue';
import { GM_openInTab } from '$';
import { updateConfig, type UiVersion } from '../../lib/config-service';
import { configureRemoteDbClient, getRemoteDbClientState } from '../../lib/remote-db';
import { useSettingsDraft } from '../composables/useSettingsDraft';
import {
  BASE_URL_ERROR, SCALE_OPTIONS, THEME_OPTIONS, UI_VERSION_OPTIONS,
  describeRemoteStatus, isRemoteChecking, remoteHint,
} from '../settings-labels';
import XmIcon from '../components/XmIcon.vue';
import XmSegmented from '../components/XmSegmented.vue';
import XmStatusPill from '../components/XmStatusPill.vue';
import XmSwitch from '../components/XmSwitch.vue';

const {
  cfg, draft, isDirty, dirtyCount, isFieldDirty, setDraft, setNumber,
  remoteDbFeatureEnabled, remoteDbConfigurable, hasInvalidBaseUrl, saveDisabled,
  save, revert, resetLayout, resetAll,
} = useSettingsDraft();

const remoteState = getRemoteDbClientState();
const remoteStatus = computed(() => describeRemoteStatus(remoteState));
const checkPending = computed(() => isRemoteChecking(remoteState));
const checkDisabled = computed(() => checkPending.value || (draft.remoteDbEnabled && hasInvalidBaseUrl.value));
const showAccountAction = computed(() => Boolean(remoteState.session?.accountUrl)
  && (remoteState.sessionState === 'anonymous' || remoteState.sessionState === 'pending_registration'));

/** Applied immediately; not part of the draft. */
function setUiVersion(value: UiVersion) {
  updateConfig({ uiVersion: value });
}

function openAccountPage() {
  const accountUrl = remoteState.session?.accountUrl;
  if (accountUrl) GM_openInTab(accountUrl, { active: true });
}

async function checkConnection(): Promise<void> {
  if (draft.remoteDbEnabled && hasInvalidBaseUrl.value) return;
  await configureRemoteDbClient({ runtimeEnabled: draft.remoteDbEnabled, baseUrl: draft.remoteDbBaseUrl });
}
</script>

<template>
  <div class="xm-view">
    <div class="xm-body">
      <div class="xm-group">
        <div class="xm-group__title">外观</div>
        <div class="xm-group__card">
          <div class="xm-set">
            <div class="xm-set__label">界面版本<span class="xm-set__desc">立即生效，可随时切回</span></div>
            <div class="xm-set__ctrl">
              <XmSegmented :model-value="cfg.uiVersion" :options="UI_VERSION_OPTIONS" aria-label="界面版本" data-role="ui-version" @update:model-value="setUiVersion" />
            </div>
          </div>
          <div class="xm-set">
            <div class="xm-set__label">主题<span v-if="isFieldDirty('theme')" class="xm-dirty" title="未保存"></span></div>
            <div class="xm-set__ctrl">
              <XmSegmented :model-value="draft.theme" :options="THEME_OPTIONS" aria-label="主题" data-role="theme" @update:model-value="(v) => setDraft('theme', v)" />
            </div>
          </div>
          <div class="xm-set">
            <label class="xm-set__label" for="xm-set-scale">内容缩放<span v-if="isFieldDirty('uiScale')" class="xm-dirty" title="未保存"></span></label>
            <div class="xm-set__ctrl">
              <select id="xm-set-scale" class="xm-select" @change="setNumber('uiScale', $event)">
                <option v-for="opt in SCALE_OPTIONS" :key="opt" :value="opt" :selected="draft.uiScale === opt">{{ opt }}%</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="xm-group">
        <div class="xm-group__title">窗口</div>
        <div class="xm-group__card">
          <div class="xm-set">
            <div class="xm-set__label" id="xm-set-pos">位置<span v-if="isFieldDirty('anchorX', 'anchorY')" class="xm-dirty" title="未保存"></span></div>
            <div class="xm-set__ctrl" role="group" aria-labelledby="xm-set-pos">
              <label class="xm-set__axis" for="xm-set-x">X</label>
              <input id="xm-set-x" class="xm-input xm-input--num" type="number" :value="draft.anchorX" @change="setNumber('anchorX', $event)" />
              <label class="xm-set__axis" for="xm-set-y">Y</label>
              <input id="xm-set-y" class="xm-input xm-input--num" type="number" :value="draft.anchorY" @change="setNumber('anchorY', $event)" />
            </div>
          </div>
          <div class="xm-set">
            <div class="xm-set__label" id="xm-set-size">尺寸<span v-if="isFieldDirty('panelWidth', 'panelHeight')" class="xm-dirty" title="未保存"></span></div>
            <div class="xm-set__ctrl" role="group" aria-labelledby="xm-set-size">
              <label class="xm-set__axis" for="xm-set-w">宽</label>
              <input id="xm-set-w" class="xm-input xm-input--num" type="number" :value="draft.panelWidth" @change="setNumber('panelWidth', $event)" />
              <label class="xm-set__axis" for="xm-set-h">高</label>
              <input id="xm-set-h" class="xm-input xm-input--num" type="number" :value="draft.panelHeight" @change="setNumber('panelHeight', $event)" />
            </div>
          </div>
          <div class="xm-set">
            <div class="xm-set__label xm-set__label--note">拖动标签栏移动窗口，拖动右下角调整大小</div>
            <div class="xm-set__ctrl"><button type="button" class="xm-btn xm-btn--sm" data-role="reset-layout" @click="resetLayout">恢复默认</button></div>
          </div>
        </div>
      </div>

      <div class="xm-group">
        <div class="xm-group__title">行为</div>
        <div class="xm-group__card">
          <div class="xm-set">
            <div class="xm-set__label xm-set__label--click" @click="setDraft('autoClearOnNavigate', !draft.autoClearOnNavigate)">
              切换页面时清空捕获<span v-if="isFieldDirty('autoClearOnNavigate')" class="xm-dirty" title="未保存"></span>
              <span class="xm-set__desc">默认保留整个页面会话内捕获的数据</span>
            </div>
            <div class="xm-set__ctrl">
              <XmSwitch :model-value="draft.autoClearOnNavigate" label="切换页面时清空捕获" @update:model-value="(v) => setDraft('autoClearOnNavigate', v)" />
            </div>
          </div>
          <div class="xm-set">
            <div class="xm-set__label xm-set__label--click" @click="setDraft('maskSensitiveMediaWarnings', !draft.maskSensitiveMediaWarnings)">
              遮罩敏感媒体<span v-if="isFieldDirty('maskSensitiveMediaWarnings')" class="xm-dirty" title="未保存"></span>
              <span class="xm-set__desc">带敏感标记的图片模糊显示，悬停查看</span>
            </div>
            <div class="xm-set__ctrl">
              <XmSwitch :model-value="draft.maskSensitiveMediaWarnings" label="遮罩敏感媒体" @update:model-value="(v) => setDraft('maskSensitiveMediaWarnings', v)" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="remoteDbFeatureEnabled" class="xm-group" data-role="remote-group">
        <div class="xm-group__title">远端数据库</div>
        <div class="xm-group__card">
          <div class="xm-set">
            <div class="xm-set__label xm-set__label--click" @click="setDraft('remoteDbEnabled', !draft.remoteDbEnabled)">
              启用远端数据库<span v-if="isFieldDirty('remoteDbEnabled')" class="xm-dirty" title="未保存"></span>
            </div>
            <div class="xm-set__ctrl">
              <XmSwitch :model-value="draft.remoteDbEnabled" label="启用远端数据库" @update:model-value="(v) => setDraft('remoteDbEnabled', v)" />
            </div>
          </div>
          <div class="xm-set">
            <div class="xm-set__label xm-set__label--fixed">连接状态</div>
            <div class="xm-set__ctrl xm-set__ctrl--status" data-role="remote-status">
              <XmStatusPill :tone="remoteStatus.tone" class="xm-set__status">{{ remoteStatus.text }}</XmStatusPill>
              <button v-if="showAccountAction" type="button" class="xm-btn xm-btn--sm xm-btn--primary" data-role="open-account" @click="openAccountPage">打开账户页<XmIcon name="external" class="xm-ico--sm" /></button>
            </div>
          </div>
          <div v-if="remoteDbConfigurable" class="xm-set xm-set--stack">
            <label class="xm-set__label" for="xm-set-url">服务地址<span v-if="isFieldDirty('remoteDbBaseUrl')" class="xm-dirty" title="未保存"></span></label>
            <div class="xm-set__row">
              <input
                id="xm-set-url"
                class="xm-input"
                :class="{ 'xm-input--invalid': hasInvalidBaseUrl }"
                type="text"
                placeholder="https://example.com"
                :value="draft.remoteDbBaseUrl"
                :aria-invalid="hasInvalidBaseUrl || undefined"
                @input="setDraft('remoteDbBaseUrl', ($event.target as HTMLInputElement).value)"
              />
              <button type="button" class="xm-btn" data-role="check" :disabled="checkDisabled" @click="checkConnection">{{ checkPending ? '检测中…' : '检测' }}</button>
            </div>
            <div v-if="hasInvalidBaseUrl" class="xm-set__error" role="alert">{{ BASE_URL_ERROR }}</div>
          </div>
          <div v-else class="xm-set">
            <div class="xm-set__label">连接检测</div>
            <div class="xm-set__ctrl"><button type="button" class="xm-btn" data-role="check" :disabled="checkDisabled" @click="checkConnection">{{ checkPending ? '检测中…' : '检测' }}</button></div>
          </div>
        </div>
        <div class="xm-set__hint">{{ remoteHint(remoteDbConfigurable) }}</div>
      </div>

      <div class="xm-group">
        <div class="xm-group__title">重置</div>
        <div class="xm-group__card">
          <div class="xm-set">
            <div class="xm-set__label">恢复所有设置为默认值<span class="xm-set__desc">放入草稿，需保存后生效</span></div>
            <div class="xm-set__ctrl"><button type="button" class="xm-btn xm-btn--sm xm-btn--danger" data-role="reset-all" @click="resetAll">重置</button></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isDirty" class="xm-footer xm-footer--dirty">
      <div class="xm-footer__meta" role="status">{{ dirtyCount }} 项更改未保存</div>
      <button type="button" class="xm-btn xm-btn--ghost" data-role="revert" @click="revert">撤销</button>
      <button type="button" class="xm-btn xm-btn--primary" data-role="save" :disabled="saveDisabled" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped>
.xm-set__label--note { color: var(--xm-text-2); font-size: var(--xm-fs-xs); }
.xm-set__label--click { cursor: pointer; }
.xm-set__label--fixed { flex: none; white-space: nowrap; }
.xm-set__ctrl--status { flex: 1 1 auto; min-width: 0; flex-wrap: wrap; justify-content: flex-end; }
.xm-set__status { max-width: 100%; height: auto; min-height: 20px; padding-top: 2px; padding-bottom: 2px; border-radius: 10px; text-align: left; white-space: normal; overflow-wrap: anywhere; }
input.xm-input--num { appearance: textfield; -moz-appearance: textfield; }
input.xm-input--num::-webkit-inner-spin-button,
input.xm-input--num::-webkit-outer-spin-button { appearance: none; -webkit-appearance: none; margin: 0; }
</style>

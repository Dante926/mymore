function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
/**
 * L1 去重冲突检测提示词（批量模式）
 *
 * 依据权威蓝图 §3.5：统一候选池（所有新记忆的候选去重合并成一个池，支持跨记忆互相去重）、
 * 四种动作 store/skip/update/merge、跨 type 合并、多对多合并（target_ids 数组）、
 * merged_priority 提升规则（信息更完整酌情提升）、JSON 输出契约。
 */

// ============================
// System Prompt
// ============================

export var CONFLICT_DETECTION_SYSTEM_PROMPT = "\u4F60\u662F\u8BB0\u5FC6\u51B2\u7A81\u68C0\u6D4B\u5668\u3002\u6279\u91CF\u6BD4\u8F83\u591A\u6761\u3010\u65B0\u8BB0\u5FC6\u3011\u4E0E\u3010\u7EDF\u4E00\u5019\u9009\u8BB0\u5FC6\u6C60\u3011\u4E2D\u7684\u5DF2\u6709\u8BB0\u5FC6\uFF0C\u9010\u6761\u51B3\u5B9A\u5982\u4F55\u5904\u7406\u3002\n\n**\u8F93\u51FA\u8BED\u8A00**\uFF1A`merged_content` \u4F7F\u7528\u4E0E\u5019\u9009\u6C60\u4E2D\u5DF2\u6709\u8BB0\u5FC6\u76F8\u540C\u7684\u8BED\u8A00\uFF1BJSON \u5B57\u6BB5\u540D\u3001\u679A\u4E3E\u503C\u3001record_id\u3001ISO \u65F6\u95F4\u6233\u4FDD\u6301\u82F1\u6587\u3002\n\n## \u6838\u5FC3\u89C4\u5219\n\n- **\u8DE8 type \u5408\u5E76**\uFF1A\u4E0D\u540C type\uFF08persona / episodic / instruction / work_fact / work_task / work_method / work_artifact\uFF09\u7684\u8BB0\u5FC6\u5982\u679C\u8BED\u4E49\u4E0A\u63CF\u8FF0\u540C\u4E00\u4E8B\u5B9E/\u4E8B\u4EF6\uFF0C**\u53EF\u4EE5\u5408\u5E76**\u3002\n- **\u591A\u5BF9\u591A\u5408\u5E76**\uFF1A\u4E00\u6761\u65B0\u8BB0\u5FC6\u53EF\u4EE5\u540C\u65F6\u66FF\u6362/\u5408\u5E76\u5019\u9009\u6C60\u4E2D\u7684**\u591A\u6761**\u5DF2\u6709\u8BB0\u5FC6\uFF08\u901A\u8FC7 target_ids \u6570\u7EC4\u6307\u5B9A\uFF09\u3002\n- \u5408\u5E76\u540E\u4F60\u5FC5\u987B\u5224\u65AD\u65B0\u8BB0\u5FC6\u7684\u6700\u4F73 type\uFF08merged_type\uFF09\u3002\n\n## \u5224\u65AD\u903B\u8F91\n\n1. **\u5206\u8FA8\u8BB0\u5FC6\u6027\u8D28**\uFF1A\n   - **\u72B6\u6001\u7C7B**\uFF08persona/instruction\uFF09\uFF1A\u504F\u597D\u3001\u7279\u8D28\u3001\u957F\u671F\u8BBE\u5B9A\u3001\u76F8\u5BF9\u7A33\u5B9A\u7684\u4E8B\u5B9E\u3001\u884C\u4E3A\u89C4\u5219\n   - **\u4E8B\u4EF6\u7C7B**\uFF08episodic\uFF09\uFF1A\u4E00\u6B21\u6027\u7ECF\u5386\u3001\u5E26\u65F6\u95F4\u70B9\u7684\u5BA2\u89C2\u8BB0\u5F55\uFF0C\u5EFA\u8BAE\u5408\u5E76\u540C\u4E00\u4EF6\u4E8B\u7684\u524D\u56E0\u540E\u679C\n\n2. **\u5224\u65AD\u662F\u5426\u540C\u4E00\u4E8B\u5B9E/\u4E8B\u4EF6**\uFF1A\u4E3B\u4F53\u76F8\u540C\u3001\u4E3B\u9898\u4E00\u81F4\u3001\u65F6\u95F4\u63A5\u8FD1\u3001scene_name \u76F8\u4F3C\n\n3. **\u9009\u62E9\u52A8\u4F5C**\uFF1A\n   - \"store\"\uFF1A\u89C6\u4E3A\u65B0\u4FE1\u606F\uFF0C\u65B0\u589E\u5F53\u524D\u8BB0\u5FC6\u3002\n   - \"skip\"\uFF1A\u5DF2\u6709\u8BB0\u5FC6\u66F4\u597D\uFF0C\u65B0\u8BB0\u5FC6\u65E0\u589E\u91CF\u6216\u66F4\u6A21\u7CCA\uFF0C\u5FFD\u7565\u5F53\u524D\u8BB0\u5FC6\u3002\n   - \"update\"\uFF1A\u540C\u4E00\u4E8B\u5B9E/\u4E8B\u4EF6\uFF0C\u65B0\u8BB0\u5FC6\u5728\u5185\u5BB9\u6216\u65F6\u95F4\u4E0A\u66F4\u4F18\uFF08\u66F4\u5177\u4F53\u3001\u66F4\u665A\u6216\u7EA0\u9519\uFF09\uFF0C\u4EE5\u65B0\u8BB0\u5FC6\u4E3A\u4E3B\u8986\u76D6\u65E7\u8BB0\u5FC6\uFF0C\u53EF\u4FDD\u7559\u65E7\u8BB0\u5FC6\u4E2D\u4ECD\u6B63\u786E\u7684\u7EC6\u8282\u3002\n   - \"merge\"\uFF1A\u540C\u4E00\u4E8B\u5B9E\u6216\u540C\u4E00\u6F14\u5316\u8FC7\u7A0B\uFF0C\u591A\u6761\u8BB0\u5FC6\u4FE1\u606F\u4E92\u8865\u4E14\u4E0D\u77DB\u76FE\uFF0C\u5408\u5E76\u6210\u4E00\u6761\u66F4\u5B8C\u6574\u8BB0\u5FC6\uFF0C\u4FE1\u606F\u5C3D\u91CF\u4E0D\u5197\u4F59\u3002\n\n4. **\u7B56\u7565\u503E\u5411**\uFF1A\n   - \u72B6\u6001\u7C7B\uFF1A\u591A\u6761\u63CF\u8FF0\u540C\u4E00\u504F\u597D/\u7279\u8D28 \u2192 \u503E\u5411 merge\uFF1B\u65E0\u589E\u91CF \u2192 skip\uFF1B\u660E\u786E\u66F4\u65B0 \u2192 update\n   - \u4E8B\u4EF6\u7C7B\uFF1A\u540C\u4E00\u4E8B\u4EF6\u7684\u524D\u56E0\u540E\u679C\u3001\u4E0D\u540C\u9636\u6BB5 \u2192 \u503E\u5411 merge \u4E3A\u4E00\u6761\u5B8C\u6574\u53D9\u8FF0\uFF1B\u5B8C\u5168\u76F8\u540C \u2192 skip\n   - \u8DE8\u7C7B\u578B\u793A\u4F8B\uFF1A\u4E00\u6761 episodic \"\u7528\u6237\u5728 2018 \u5E74\u5F00\u59CB\u505A\u64AD\u5BA2\" + \u4E00\u6761 persona \"\u7528\u6237\u6709\u64AD\u5BA2\u5236\u4F5C\u7ECF\u9A8C\" \u2192 \u53EF merge \u4E3A\u4E00\u6761 persona \u6216 episodic\uFF08\u53D6\u51B3\u4E8E\u4FE1\u606F\u4FA7\u91CD\uFF09\n\n5. **timestamp \u5904\u7406**\uFF1A\n   - merge / update \u65F6\uFF0Cmerged_timestamps \u5E94\u5305\u542B**\u6240\u6709\u76F8\u5173\u8BB0\u5FC6\u7684\u65F6\u95F4\u6233\u5E76\u96C6**\uFF08\u53BB\u91CD\u6392\u5E8F\uFF09\n   - \u8FD9\u6837\u53EF\u4EE5\u4FDD\u7559\u4E8B\u4EF6\u53D1\u751F\u7684\u5B8C\u6574\u65F6\u95F4\u7EBF\n\n## \u8F93\u51FA\u683C\u5F0F\n\n\u4E25\u683C\u8F93\u51FA JSON \u6570\u7EC4\uFF0C\u6BCF\u4E2A\u5143\u7D20\u5BF9\u5E94\u4E00\u6761\u65B0\u8BB0\u5FC6\u7684\u51B3\u7B56\u3002\u4E0D\u8F93\u51FA\u4EFB\u4F55\u5176\u4ED6\u5185\u5BB9\uFF1A\n\n[\n  {\n    \"record_id\": \"\u65B0\u8BB0\u5FC6\u7684 record_id\",\n    \"action\": \"store|update|skip|merge\",\n    \"target_ids\": [\"\u8981\u5220\u9664\u7684\u5019\u9009\u8BB0\u5FC6 record_id 1\", \"record_id 2\"],\n    \"merged_content\": \"\u5408\u5E76/\u66F4\u65B0\u540E\u7684\u8BB0\u5FC6\u5185\u5BB9\uFF08merge/update \u65F6\u5FC5\u586B\uFF09\",\n    \"merged_type\": \"\u5408\u5E76\u540E\u7684\u6700\u4F73 type\uFF1Apersona|episodic|instruction|work_fact|work_task|work_method|work_artifact\uFF08merge/update \u65F6\u5FC5\u586B\uFF09\",\n    \"merged_priority\": 85,\n    \"merged_timestamps\": [\"\u5408\u5E76\u540E\u7684\u65F6\u95F4\u6233\u6570\u7EC4\uFF0C\u5305\u542B\u6240\u6709\u65B0\u65E7\u8BB0\u5FC6\u65F6\u95F4\u6233\u7684\u5E76\u96C6\uFF08merge/update \u65F6\u5FC5\u586B\uFF09\"]\n  }\n]\n\n\u5B57\u6BB5\u8BF4\u660E\uFF1A\n- target_ids\uFF1A\u8981\u5220\u9664\u66FF\u6362\u7684\u65E7\u8BB0\u5FC6 ID **\u6570\u7EC4**\uFF08\u53EF\u4EE5 1 \u6761\u6216\u591A\u6761\uFF09\u3002store/skip \u65F6\u7701\u7565\u6216\u4E3A\u7A7A\u3002\n- merged_content\uFF1Amerge/update \u65F6\u7684\u6700\u7EC8\u8BB0\u5FC6\u6587\u672C\u3002store/skip \u65F6\u7701\u7565\u3002\n- merged_type\uFF1Amerge/update \u540E\u8BB0\u5FC6\u5E94\u5F52\u5C5E\u7684 type\u3002\u6839\u636E\u5408\u5E76\u540E\u5185\u5BB9\u672C\u8D28\u5224\u65AD\u3002\n- merged_priority\uFF1Amerge/update \u540E\u7684\u65B0\u4F18\u5148\u7EA7\uFF080-100 \u6574\u6570\uFF0Cmerge/update \u65F6\u5FC5\u586B\uFF09\u3002\u5408\u5E76\u540E\u4FE1\u606F\u66F4\u5B8C\u6574\u3001\u66F4\u786E\u5B9A\uFF0C\u901A\u5E38\u5E94**\u914C\u60C5\u63D0\u5347** priority\uFF08\u4F8B\u5982\u4E24\u6761 priority 70 \u7684\u8BB0\u5FC6\u5408\u5E76\u540E\u53EF\u63D0\u5347\u5230 80\uFF09\u3002\u53C2\u8003\u6807\u51C6\uFF1A80-100\uFF08\u6838\u5FC3\u7279\u8D28/\u91CD\u8981\u4E8B\u4EF6\uFF09\uFF0C60-79\uFF08\u4E00\u822C\u504F\u597D/\u666E\u901A\u6D3B\u52A8\uFF09\uFF0C<60\uFF08\u6B21\u8981\u4FE1\u606F\uFF09\u3002\n- merged_timestamps\uFF1A\u5408\u5E76\u540E\u7684\u65F6\u95F4\u6233\u6570\u7EC4\u3002\u6536\u96C6\u65B0\u8BB0\u5FC6 + \u6240\u6709\u88AB\u5408\u5E76\u65E7\u8BB0\u5FC6\u7684\u65F6\u95F4\u6233\uFF0C\u53BB\u91CD\u6392\u5E8F\u3002";

// ============================
// Prompt Builder
// ============================

/**
 * 每条新记忆的候选召回结果。
 */

/**
 * 组装批量冲突检测 prompt：统一候选池 + 每条新记忆关联的候选 ID。
 *
 * 统一候选池：所有新记忆召回到的候选去重合并成一个池（支持跨记忆互相去重），
 * LLM 一次看到全局，同时处理多条新记忆的判定。
 */
export function formatBatchConflictPrompt(matches) {
  // Step 1: 构建统一候选池（跨新记忆去重），并记录每条新记忆关联的候选 ID
  var unifiedPool = new Map();
  var perMemoryCandidateIds = new Map();
  var _iterator = _createForOfIteratorHelper(matches),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var m = _step.value;
      var candidateIds = [];
      var _iterator2 = _createForOfIteratorHelper(m.candidates),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var c = _step2.value;
          if (!unifiedPool.has(c.id)) {
            unifiedPool.set(c.id, c);
          }
          candidateIds.push(c.id);
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      perMemoryCandidateIds.set(m.newMemory.record_id, candidateIds);
    }

    // Step 2: 格式化统一候选池为 JSON
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  var poolList = Array.from(unifiedPool.values()).map(function (c) {
    var _c$scene_name;
    return {
      record_id: c.id,
      content: c.content,
      type: c.type,
      priority: c.priority,
      scene_name: (_c$scene_name = c.scene_name) !== null && _c$scene_name !== void 0 ? _c$scene_name : '',
      timestamps: [c.created_at]
    };
  });
  var poolSection;
  if (poolList.length === 0) {
    poolSection = '## 统一候选记忆池\n\n（空，没有已有记忆，所有新记忆直接 store）';
  } else {
    var poolStr = JSON.stringify(poolList, null, 2);
    poolSection = "## \u7EDF\u4E00\u5019\u9009\u8BB0\u5FC6\u6C60\uFF08\u5171 ".concat(poolList.length, " \u6761\u5DF2\u6709\u8BB0\u5FC6\uFF09\n\n").concat(poolStr);
  }

  // Step 3: 格式化每条新记忆与其关联候选 ID
  var memoryParts = matches.map(function (m, idx) {
    var _perMemoryCandidateId, _m$newMemory$scene_na;
    var relatedIds = (_perMemoryCandidateId = perMemoryCandidateIds.get(m.newMemory.record_id)) !== null && _perMemoryCandidateId !== void 0 ? _perMemoryCandidateId : [];
    var relatedNote = relatedIds.length > 0 ? JSON.stringify(relatedIds) : '[]（无相似候选，直接 store）';
    var memStr = JSON.stringify({
      record_id: m.newMemory.record_id,
      content: m.newMemory.content,
      type: m.newMemory.type,
      priority: m.newMemory.priority,
      scene_name: (_m$newMemory$scene_na = m.newMemory.scene_name) !== null && _m$newMemory$scene_na !== void 0 ? _m$newMemory$scene_na : ''
    }, null, 2);
    return "### \u7B2C ".concat(idx + 1, " \u6761\u65B0\u8BB0\u5FC6 (record_id: ").concat(m.newMemory.record_id, ")\n").concat(memStr, "\n\n\u3010\u5173\u8054\u5019\u9009 ID\u3011").concat(relatedNote);
  });
  var newMemoriesText = memoryParts.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

  // Step 4: 组装最终 prompt
  return "**\u8F93\u51FA\u8BED\u8A00**\uFF1A`merged_content` \u4F7F\u7528\u4E0E\u5019\u9009\u6C60\u4E2D\u5DF2\u6709\u8BB0\u5FC6\u76F8\u540C\u7684\u8BED\u8A00\u3002\n\n".concat(poolSection, "\n\n").concat('═'.repeat(50), "\n\n## \u5F85\u5224\u65AD\u7684\u65B0\u8BB0\u5FC6\uFF08\u5171 ").concat(matches.length, " \u6761\uFF09\n\n").concat(newMemoriesText, "\n\n\u8BF7\u9010\u6761\u5224\u65AD\u5E76\u8F93\u51FA\u51B3\u7B56 JSON \u6570\u7EC4\u3002\u5F53\u67D0\u6761\u65B0\u8BB0\u5FC6\u7684\u5019\u9009\u5217\u8868\u4E3A\u7A7A\u65F6\uFF0C\u8BE5\u6761\u76F4\u63A5\u8F93\u51FA action=store\u3002");
}

// ============================
// 导出的类型辅助
// ============================

/** 合并后的记忆类型，与 L1RecordType 一致。 */
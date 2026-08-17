// Hand-written browser bundle for dsh-plugin-long-task-reminder.
// Registers the plugin's config card into the shared Plugins configuration
// section (`settings.plugin.item` slot). The card reads/writes the
// `long-task-reminder` settings namespace through the client settingsScope
// service; the bundle is a classic script that registers its factory with the
// client module loader, exactly like the tsdown-built client bundles.
window.__ModuleLoader__.load({
	id: "dsh-plugin-long-task-reminder",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		var React = require("react");
		var useState = React.useState;
		var createSnapshotStore = require("@deepseek-ai/dsh-client-runtime/client").createSnapshotStore;

		// Namespace this plugin registers with the Host settings service.
		var NS = "long-task-reminder";

		// Field order and wire kind. "number" fields stage as text and parse on save.
		var FIELDS = [
			{ key: "feishuWebhook", kind: "text" },
			{ key: "notifyOnCreate", kind: "boolean" },
			{ key: "notifyOnComplete", kind: "boolean" },
			{ key: "notifyOnBlocked", kind: "boolean" },
			{ key: "notifyOnPaused", kind: "boolean" },
			{ key: "notifyOnApproval", kind: "boolean" },
			{ key: "notifyOnError", kind: "boolean" },
			{ key: "dryRun", kind: "boolean" },
			{ key: "cooldownMs", kind: "number" },
		];

		// Boolean controls with their display copy (product copy is Chinese).
		var TOGGLES = [
			{ key: "notifyOnCreate", label: "任务开始", hint: "创建或开始长任务时提醒" },
			{ key: "notifyOnComplete", label: "任务完成", hint: "任务正常结束时提醒" },
			{ key: "notifyOnBlocked", label: "任务受阻", hint: "任务受阻时提醒" },
			{ key: "notifyOnPaused", label: "任务暂停", hint: "任务暂停时提醒" },
			{ key: "notifyOnApproval", label: "需要审批", hint: "产生审批请求、需要交互时提醒" },
			{ key: "notifyOnError", label: "运行出错", hint: "运行出错时提醒" },
			{ key: "dryRun", label: "演练模式", hint: "不真正发送飞书消息（用于测试）" },
		];

		// Inline styles consume the shared semantic theme tokens (no CSS injection).
		var s = {
			card: { border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-1)", overflow: "hidden" },
			header: { display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" },
			headText: { flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" },
			name: { fontSize: "14px", fontWeight: "600", color: "var(--dsw-alias-label-primary)" },
			desc: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" },
			pending: { fontSize: "12px", color: "var(--dsw-alias-state-warn-label)", whiteSpace: "nowrap" },
			chevron: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)", transition: "transform .15s" },
			body: { padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "12px" },
			field: { display: "flex", flexDirection: "column", gap: "4px" },
			fieldHead: { display: "flex", alignItems: "baseline", gap: "8px" },
			label: { fontSize: "13px", color: "var(--dsw-alias-label-primary)", fontWeight: "500" },
			hint: { fontSize: "12px", color: "var(--dsw-alias-label-dimmed)" },
			input: { width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-base)", color: "var(--dsw-alias-label-primary)", fontSize: "13px" },
			toggleRow: { display: "flex", alignItems: "center", gap: "8px", padding: "2px 0" },
			toggleLabel: { flex: "1", fontSize: "13px", color: "var(--dsw-alias-label-primary)" },
			toggleHint: { fontSize: "12px", color: "var(--dsw-alias-label-dimmed)" },
			badge: { fontSize: "11px", color: "var(--dsw-alias-brand-text)", border: "1px solid var(--dsw-alias-border-l2)", padding: "1px 6px", borderRadius: "10px", whiteSpace: "nowrap" },
			footer: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginTop: "4px" },
			saved: { fontSize: "12px", color: "var(--dsw-alias-state-success-primary)", marginRight: "auto" },
			btn: { padding: "5px 14px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", color: "var(--dsw-alias-label-primary)", fontSize: "13px", cursor: "pointer" },
			btnPrimary: { border: "none", background: "var(--dsw-alias-button-primary-fill)", color: "var(--dsw-alias-button-contrast-fill)" },
			btnDisabled: { opacity: "0.5", cursor: "default" },
			readOnly: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" },
			status: { fontSize: "12px", color: "var(--dsw-alias-label-dimmed)" },
		};

		/** Render an undefined/null field value as an empty string. */
		function textOf(value) {
			return value === undefined || value === null ? "" : String(value);
		}

		/** Merged button style honoring the primary and disabled flags. */
		function buttonStyle(primary, disabled) {
			var base = primary ? Object.assign({}, s.btn, s.btnPrimary) : Object.assign({}, s.btn);
			return disabled ? Object.assign({}, base, s.btnDisabled) : base;
		}

		/** One labelled text input with an optional "modified" badge. */
		function textFieldChrome(label, hint, inputValue, overridden, writable, onEdit) {
			return React.createElement("label", { style: s.field },
				React.createElement("span", { style: s.fieldHead },
					React.createElement("span", { style: s.label }, label),
					overridden ? React.createElement("span", { style: s.badge }, "已修改") : null),
				React.createElement("span", { style: s.hint }, hint),
				React.createElement("input", { style: s.input, type: "text", value: inputValue, disabled: !writable, onChange: function (event) { onEdit(event.target.value); } }));
		}

		/** The plugin's configuration card, rendered inside the Plugins section. */
		function LongTaskReminderCard(props) {
			var state = props.useLongTaskReminder(function (snapshot) { return snapshot; });
			var open = useState(false);
			var isOpen = open[0];
			var setOpen = open[1];

			// A namespace the deployment does not expose leaves no trace of the card.
			if (!state.available) return null;

			var webhook = state.fields.feishuWebhook;
			var cooldown = state.fields.cooldownMs;

			return React.createElement("li", { style: s.card },
				React.createElement("button", { type: "button", style: s.header, onClick: function () { setOpen(!isOpen); } },
					React.createElement("span", { style: s.headText },
						React.createElement("span", { style: s.name }, "长任务提醒"),
						React.createElement("span", { style: s.desc }, "任务完成或需要交互时，通过飞书自定义机器人推送提醒")),
					state.dirty ? React.createElement("span", { style: s.pending }, "未保存") : null,
					React.createElement("span", { style: Object.assign({}, s.chevron, isOpen ? { transform: "rotate(180deg)" } : null) }, isOpen ? "▴" : "▾")),
				isOpen
					? React.createElement("div", { style: s.body },
						state.status === "loading"
							? React.createElement("p", { style: s.status }, "加载中…")
							: null,
						!state.writable
							? React.createElement("p", { style: s.readOnly }, "该配置当前为只读，无法从页面修改。")
							: null,
						textFieldChrome("飞书 Webhook", "提醒推送的飞书自定义机器人地址", textOf(webhook.value), webhook.overridden, state.writable, function (value) { props.edit("feishuWebhook", value); }),
						React.createElement("div", { style: { display: "flex", flexDirection: "column" } },
							TOGGLES.map(function (def) {
								var field = state.fields[def.key];
								return React.createElement("label", { key: def.key, style: s.toggleRow },
									React.createElement("input", { type: "checkbox", checked: !!field.value, disabled: !state.writable, onChange: function (event) { props.edit(def.key, event.target.checked); } }),
									React.createElement("span", { style: { flex: "1", minWidth: "0" } },
										React.createElement("span", { style: { display: "block", fontSize: "13px", color: "var(--dsw-alias-label-primary)" } }, def.label),
										React.createElement("span", { style: s.toggleHint }, def.hint)),
									field.overridden ? React.createElement("span", { style: s.badge }, "已修改") : null);
							})),
						textFieldChrome("冷却间隔（毫秒）", "同一类通知的最短发送间隔，避免刷屏", textOf(cooldown.value), cooldown.overridden, state.writable, function (value) {
							// Stage digits only so save always parses a valid integer.
							props.edit("cooldownMs", value.replace(/[^0-9]/g, ""));
						}),
						React.createElement("div", { style: s.footer },
							state.saved ? React.createElement("span", { style: s.saved }, "已保存") : null,
							state.dirty
								? React.createElement("button", { type: "button", style: buttonStyle(false, state.saving), disabled: state.saving, onClick: props.discard }, "放弃更改")
								: null,
							React.createElement("button", { type: "button", style: buttonStyle(true, state.saving || !state.dirty || !state.writable), disabled: state.saving || !state.dirty || !state.writable, onClick: props.save }, state.saving ? "保存中…" : "保存")))
					: null);
		}

		/** Build the card controller over one bound settings scope. */
		function createController(scope, onEffect) {
			var draft = {};
			var saving = false;
			var saved = false;

			var store = createSnapshotStore(project());
			onEffect(function () {
				return scope.subscribe(function () { store.set(project()); });
			});

			/** Project the scope snapshot plus the staged draft into the card state. */
			function project() {
				var snap = scope.getSnapshot();
				var values = snap.value || {};
				var fields = {};
				for (var i = 0; i < FIELDS.length; i++) {
					var key = FIELDS[i].key;
					var staged = draft[key];
					var resolved = values[key];
					fields[key] = {
						value: staged !== undefined ? staged : resolved,
						overridden: staged !== undefined,
					};
				}
				return {
					available: snap.status !== "unavailable",
					status: snap.status,
					writable: !!snap.writable,
					dirty: Object.keys(draft).length > 0,
					saving: saving,
					saved: saved,
					fields: fields,
				};
			}

			/** Stage one field value; the card turns dirty. */
			function edit(key, value) {
				draft = Object.assign({}, draft);
				draft[key] = value;
				saved = false;
				store.set(project());
			}

			/** Drop every staged edit. */
			function discard() {
				draft = {};
				saving = false;
				saved = false;
				store.set(project());
			}

			/** Write every staged edit through the scope, then clear the draft. */
			function save() {
				if (saving) return Promise.resolve();
				saving = true;
				saved = false;
				store.set(project());
				var snap = scope.getSnapshot();
				var values = snap.value || {};
				var ops = [];
				for (var i = 0; i < FIELDS.length; i++) {
					var key = FIELDS[i].key;
					var kind = FIELDS[i].kind;
					if (!(key in draft)) continue;
					var raw = draft[key];
					var current = values[key];
					var next;
					if (kind === "boolean") {
						next = !!raw;
					} else if (kind === "number") {
						var text = textOf(raw).trim();
						if (text === "") {
							next = undefined;
						} else {
							var parsed = Number(text);
							if (!isFinite(parsed)) continue; // input is digit-only; keep staged untouched
							next = parsed;
						}
					} else {
						next = typeof raw === "string" ? raw : textOf(raw);
						if (next === "") next = undefined;
					}
					if (next === undefined) {
						if (current !== undefined && current !== null && current !== "") ops.push({ key: key, op: "unset" });
					} else if (next !== current) {
						ops.push({ key: key, op: "set", value: next });
					}
				}
				var chain = Promise.resolve();
				for (var j = 0; j < ops.length; j++) {
					(function (op) {
						chain = chain.then(function () {
							if (op.op === "unset") return scope.unset(op.key);
							return scope.set(op.key, op.value);
						});
					})(ops[j]);
				}
				return chain.then(function () {
					draft = {};
					saving = false;
					saved = true;
					store.set(project());
				});
			}

			return {
				inject: function () {
					return {
						hooks: { longTaskReminder: store },
						edit: edit,
						discard: discard,
						save: save,
					};
				},
			};
		}

		exports.inject = ["slots", "settingsScope"];
		exports.apply = function (ctx) {
			var scope = ctx.settingsScope.bind({ namespace: NS });
			var card = createController(scope, function (disposer) {
				ctx.effect(disposer, "long-task-reminder: card projection");
			});
			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					id: "long-task-reminder",
					order: 30,
					inject: function () { return card.inject(); },
				}, LongTaskReminderCard);
			});
		};

		return module.exports;
	}
});

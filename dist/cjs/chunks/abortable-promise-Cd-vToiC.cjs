//#region dist/esm/utils/abortable-promise.js
function settleAbortable(task, signal, disposeLateResult) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (body) => {
			if (settled) return;
			settled = true;
			signal.removeEventListener("abort", abort);
			body();
		};
		const abort = () => finish(() => {
			var _a;
			return reject((_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException("The asynchronous task was aborted.", "AbortError"));
		});
		signal.addEventListener("abort", abort, { once: true });
		if (signal.aborted) abort();
		task.then((value) => {
			if (settled) {
				try {
					disposeLateResult === null || disposeLateResult === void 0 || disposeLateResult(value);
				} catch {}
				return;
			}
			finish(() => resolve(value));
		}, (error) => finish(() => reject(error)));
	});
}

//#endregion
Object.defineProperty(exports, 'settleAbortable', {
  enumerable: true,
  get: function () {
    return settleAbortable;
  }
});
//# sourceMappingURL=abortable-promise-Cd-vToiC.cjs.map
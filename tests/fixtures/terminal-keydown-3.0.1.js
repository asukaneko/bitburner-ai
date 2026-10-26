// Extracted from Bitburner 3.0.1 TerminalInput.tsx. See THIRD_PARTY_NOTICES.md.
function keyDown(event) {
      if (Terminal.contractOpen || Terminal.nsPromptApiOpen) {
        return;
      }
      if (Terminal.action !== null && event.key === KEY.C && event.ctrlKey) {
        Terminal.finishAction(true);
        return;
      }
      const ref = terminalInput.current;
      if (event.ctrlKey || event.metaKey) return;
      if (event.key === KEY.C && (event.ctrlKey || event.metaKey)) return; // trying to copy
      // Don't steal focus from other input elements
      const target = event.target;
      if (
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable)) &&
        target !== ref
      ) {
        return;
      }
      if (ref) ref.focus();
    }

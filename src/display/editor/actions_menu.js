/* Copyright 2023 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { copyIconSVG, partitionOutlinedSVG } from "../../images/svgIcons.js";
import { noContextMenu } from "../display_utils.js";

class ActionsMenu {
  #menu = null;

  #editor;

  #buttons = null;

  constructor(editor) {
    this.#editor = editor;
  }

  render({ copyAction, linkNodeAction }) {
    const actionsMenu = (this.#menu = document.createElement("div"));
    actionsMenu.className = "actionsMenuBar";
    actionsMenu.addEventListener("contextmenu", noContextMenu);
    actionsMenu.addEventListener("pointerdown", ActionsMenu.#pointerDown);

    const buttons = (this.#buttons = document.createElement("div"));
    buttons.className = "buttons";
    actionsMenu.append(buttons);

    const position = this.#editor.actionsMenuPosition;
    if (position) {
      const { style } = actionsMenu;
      const x =
        this.#editor._uiManager.direction === "ltr"
          ? 1 - position[0]
          : position[0];
      style.insetInlineEnd = `${100 * x}%`;
      style.top = `calc(${100 * position[1]}% + var(--action-bar-vert-offset))`;
    }

    this.#addActionButtons({ copyAction, linkNodeAction });

    return actionsMenu;
  }

  static #pointerDown(e) {
    e.stopPropagation();
  }

  #focusIn(e) {
    this.#editor._focusEventsAllowed = false;
    e.preventDefault();
    e.stopPropagation();
  }

  #focusOut(e) {
    this.#editor._focusEventsAllowed = true;
    e.preventDefault();
    e.stopPropagation();
  }

  #addListenersToElement(element) {
    // If we're clicking on a button with the keyboard or with
    // the mouse, we don't want to trigger any focus events on
    // the editor.
    element.addEventListener("focusin", this.#focusIn.bind(this), {
      capture: true,
    });
    element.addEventListener("focusout", this.#focusOut.bind(this), {
      capture: true,
    });
    element.addEventListener("contextmenu", noContextMenu);
  }

  hide() {
    this.#menu.classList.add("hidden");
  }

  show() {
    this.#menu.classList.remove("hidden");
  }

  #addActionButtons({ copyAction, linkNodeAction }) {
    const copyButton = document.createElement("div");
    copyButton.innerHTML = `${copyIconSVG} Copy Text`;
    this.#addListenersToElement(copyButton);
    copyButton.addEventListener("click", copyAction);

    const linkNodeButton = document.createElement("div");
    linkNodeButton.innerHTML = `${partitionOutlinedSVG} Link Node`;
    this.#addListenersToElement(linkNodeButton);
    linkNodeButton.addEventListener("click", linkNodeAction);

    this.#buttons.append(copyButton);
    this.#buttons.append(linkNodeButton);
  }

  remove() {
    this.#menu.remove();
  }
}

export { ActionsMenu };

/* Copyright 2022 Mozilla Foundation
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

import {
  AnnotationEditorParamsType,
  AnnotationEditorType,
  Util,
} from "../../shared/util.js";
import { AnnotationEditor } from "./editor.js";
import { bindEvents } from "./tools.js";
import { Outliner } from "./outliner.js";

/**
 * Basic draw editor in order to generate an Underline annotation.
 */
class UnderlineEditor extends AnnotationEditor {
  #boxes;

  #clipPathId = null;

  #highlightDiv = null;

  #highlightUnderlines = null;

  #id = null;

  #lastPoint = null;

  #opacity;

  selectedText = "";

  static _defaultColor = null;

  static _defaultOpacity = 1;

  static _l10nPromise;

  static _type = "underline";

  static _editorType = AnnotationEditorType.UNDERLINE;

  constructor(params) {
    super({ ...params, name: "underlineEditor" });
    UnderlineEditor._defaultColor ||=
      this._uiManager.highlightColors?.values().next().value || "#fff066";
    this.color = params.color || UnderlineEditor._defaultColor;
    this.#opacity = params.opacity || UnderlineEditor._defaultOpacity;
    this.#boxes = params.boxes || null;
    this._isDraggable = false;
    this.selectedText = params.text || "";

    if (this.#boxes) {
      this.#createUnderlines();
      this.#addToDrawLayer();
      this.rotate(this.rotation);
    }
  }

  #createUnderlines() {
    const outliner = new Outliner(
      this.#boxes,
      /* borderWidth = */ 0.001,
      0,
      true,
      this
    );
    this.#highlightUnderlines = outliner.getUnderlinesAndStrikeouts();
    ({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    } = this.#highlightUnderlines.box);

    // The last point is in the pages coordinate system.
    const { lastPoint } = this.#highlightUnderlines.box;
    this.#lastPoint = [
      (lastPoint[0] - this.x) / this.width,
      (lastPoint[1] - this.y) / this.height,
    ];
  }

  static initialize(l10n) {
    AnnotationEditor.initialize(l10n);
  }

  static updateDefaultParams(type, value) {
    switch (type) {
      case AnnotationEditorParamsType.HIGHLIGHT_COLOR:
        UnderlineEditor._defaultColor = value;
        break;
    }
  }

  /** @inheritdoc */
  get toolbarPosition() {
    return this.#lastPoint;
  }

  /** @inheritdoc */
  updateParams(type, value) {
    switch (type) {
      case AnnotationEditorParamsType.HIGHLIGHT_COLOR:
        this.#updateColor(value);
        break;
    }
  }

  get localParams() {
    return {
      [AnnotationEditorParamsType.HIGHLIGHT_COLOR]: this.color,
    };
  }

  static get defaultPropertiesToUpdate() {
    return [
      [
        AnnotationEditorParamsType.HIGHLIGHT_COLOR,
        UnderlineEditor._defaultColor,
      ],
    ];
  }

  /** @inheritdoc */
  get propertiesToUpdate() {
    return [
      [
        AnnotationEditorParamsType.HIGHLIGHT_COLOR,
        this.color || UnderlineEditor._defaultColor,
      ],
    ];
  }

  /**
   * Update the color and make this action undoable.
   * @param {string} color
   */
  #updateColor(color) {
    if (color === this.color) {
      return;
    }

    const savedColor = this.color;
    this.addCommands({
      cmd: () => {
        this.color = color;
        this.parent.drawLayer.changeColor(
          this.#id,
          color,
          UnderlineEditor._editorType
        );
      },
      undo: () => {
        this.color = savedColor;
        this.parent.drawLayer.changeColor(
          this.#id,
          savedColor,
          UnderlineEditor._editorType
        );
      },
      mustExec: true,
      type: AnnotationEditorParamsType.HIGHLIGHT_COLOR,
      overwriteIfSameType: true,
      keepUndo: true,
    });
  }

  /** @inheritdoc */
  async addEditToolbar() {
    const props = {
      onColorSelect: this.#updateColor.bind(this),
      initialColor: this.color,
    };

    const toolbar = await super.addEditToolbar(props);
    if (!toolbar) {
      return null;
    }

    return toolbar;
  }

  /** @inheritdoc */
  disableEditing() {
    super.disableEditing();
    this.div.classList.toggle("disabled", true);
  }

  /** @inheritdoc */
  enableEditing() {
    super.enableEditing();
    this.div.classList.toggle("disabled", false);
  }

  /** @inheritdoc */
  fixAndSetPosition() {
    return super.fixAndSetPosition(0);
  }

  /** @inheritdoc */
  getRect(tx, ty) {
    return super.getRect(tx, ty, 0);
  }

  /** @inheritdoc */
  onceAdded() {
    this.parent.addUndoableEditor(this);
    if (!this.wasAddedFromApi) {
      this.div.focus();
    }
  }

  /** @inheritdoc */
  remove() {
    super.remove();
    this.#cleanDrawLayer();
  }

  /** @inheritdoc */
  rebuild() {
    if (!this.parent) {
      return;
    }
    super.rebuild();
    if (this.div === null) {
      return;
    }

    this.#addToDrawLayer();

    if (!this.isAttachedToDOM) {
      // At some point this editor was removed and we're rebuilting it,
      // hence we must add it to its parent.
      this.parent.add(this);
    }
  }

  setParent(parent) {
    let mustBeSelected = false;
    if (this.parent && !parent) {
      this.#cleanDrawLayer();
    } else if (parent) {
      this.#addToDrawLayer(parent);
      // If mustBeSelected is true it means that this editor was selected
      // when its parent has been destroyed, hence we must select it again.
      mustBeSelected =
        !this.parent && this.div?.classList.contains("selectedEditor");
    }
    super.setParent(parent);
    if (mustBeSelected) {
      // We select it after the parent has been set.
      this.select();
    }
  }

  #cleanDrawLayer() {
    if (this.#id === null || !this.parent) {
      return;
    }
    this.parent.drawLayer.remove(this.#id);
    this.#id = null;
  }

  #addToDrawLayer(parent = this.parent) {
    if (this.#id !== null) {
      return;
    }
    ({ id: this.#id } = parent.drawLayer.underline(
      this.#highlightUnderlines,
      this.color,
      this.#opacity
    ));
  }

  static #rotateBbox({ x, y, width, height }, angle) {
    switch (angle) {
      case 90:
        return {
          x: 1 - y - height,
          y: x,
          width: height,
          height: width,
        };
      case 180:
        return {
          x: 1 - x - width,
          y: 1 - y - height,
          width,
          height,
        };
      case 270:
        return {
          x: y,
          y: 1 - x - width,
          width: height,
          height: width,
        };
    }
    return {
      x,
      y,
      width,
      height,
    };
  }

  /** @inheritdoc */
  rotate(angle) {
    const { drawLayer } = this.parent;
    drawLayer.rotate(this.#id, angle);
    drawLayer.updateBox(this.#id, UnderlineEditor.#rotateBbox(this, angle));
  }

  /** @inheritdoc */
  render() {
    if (this.div) {
      return this.div;
    }

    const div = super.render();
    const highlightDiv = (this.#highlightDiv = document.createElement("div"));
    div.append(highlightDiv);
    highlightDiv.className = "internal";
    highlightDiv.style.clipPath = this.#clipPathId;
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.setDims(this.width * parentWidth, this.height * parentHeight);

    bindEvents(this, this.#highlightDiv, ["pointerover", "pointerleave"]);
    this.enableEditing();

    return div;
  }

  pointerover() {
    // this.parent.drawLayer.addClass(this.#outlineId, "hovered");
  }

  pointerleave() {
    // this.parent.drawLayer.removeClass(this.#outlineId, "hovered");
  }

  /** @inheritdoc */
  select() {
    super.select();
  }

  /** @inheritdoc */
  unselect() {
    super.unselect();
  }

  #serializeBoxes() {
    const [pageWidth, pageHeight] = this.pageDimensions;
    const boxes = this.#boxes;
    const quadPoints = new Array(boxes.length * 8);
    let i = 0;
    for (const { x, y, width, height } of boxes) {
      const sx = x * pageWidth;
      const sy = (1 - y - height) * pageHeight;
      // The specifications say that the rectangle should start from the bottom
      // left corner and go counter-clockwise.
      // But when opening the file in Adobe Acrobat it appears that this isn't
      // correct hence the 4th and 6th numbers are just swapped.
      quadPoints[i] = quadPoints[i + 4] = sx;
      quadPoints[i + 1] = quadPoints[i + 3] = sy;
      quadPoints[i + 2] = quadPoints[i + 6] = sx + width * pageWidth;
      quadPoints[i + 5] = quadPoints[i + 7] = sy + height * pageHeight;
      i += 8;
    }
    return quadPoints;
  }

  #serializeUnderlines() {
    const [pageWidth, pageHeight] = this.pageDimensions;
    const underlineBoxes = this.#highlightUnderlines.lineRects;
    const box = this.#highlightUnderlines.box;
    const underlines = new Array(underlineBoxes.length * 8);
    let i = 0;
    for (const { x1, y1, x2, y2 } of underlineBoxes) {
      const x = box.x + x1 * box.width;
      const y = box.y + y1 * box.height;
      const height = (y2 - y1) * box.height;
      const width = (x2 - x1) * box.width;
      const sx = x * pageWidth;
      const sy = (1 - y - height) * pageHeight;
      // The specifications say that the rectangle should start from the bottom
      // left corner and go counter-clockwise.
      // But when opening the file in Adobe Acrobat it appears that this isn't
      // correct hence the 4th and 6th numbers are just swapped.
      underlines[i] = underlines[i + 4] = sx;
      underlines[i + 1] = underlines[i + 3] = sy;
      underlines[i + 2] = underlines[i + 6] = sx + width * pageWidth;
      underlines[i + 5] = underlines[i + 7] = sy + height * pageHeight;
      i += 8;
    }
    return underlines;
  }

  /** @inheritdoc */
  static deserialize(data, parent, uiManager) {
    const editor = super.deserialize(data, parent, uiManager);

    const { rect, color, quadPoints } = data;
    editor.color = Util.makeHexColor(...color);
    editor.#opacity = data.opacity;

    const [pageWidth, pageHeight] = editor.pageDimensions;
    editor.width = (rect[2] - rect[0]) / pageWidth;
    editor.height = (rect[3] - rect[1]) / pageHeight;
    const boxes = (editor.#boxes = []);
    for (let i = 0; i < quadPoints.length; i += 8) {
      boxes.push({
        x: quadPoints[4] / pageWidth,
        y: 1 - quadPoints[i + 5] / pageHeight,
        width: (quadPoints[i + 2] - quadPoints[i]) / pageWidth,
        height: (quadPoints[i + 5] - quadPoints[i + 1]) / pageHeight,
      });
    }

    return editor;
  }

  /** @inheritdoc */
  serialize(isForCopying = false) {
    // It doesn't make sense to copy/paste a highlight annotation.
    if (this.isEmpty() || isForCopying) {
      return null;
    }

    const rect = this.getRect(0, 0);
    const color = AnnotationEditor._colorManager.convert(this.color);

    return {
      annotationType: AnnotationEditorType.UNDERLINE,
      color,
      opacity: this.#opacity,
      quadPoints: this.#serializeBoxes(),
      underlines: this.#serializeUnderlines(),
      pageIndex: this.pageIndex,
      rect,
      rotation: 0,
      structTreeParentId: this._structTreeParentId,
    };
  }

  serializeToJSON() {
    if (this.isEmpty()) {
      return null;
    }

    const rect = this.getRect(0, 0);

    return {
      annotationType: AnnotationEditorType.UNDERLINE,
      color: this.color,
      opacity: this.#opacity,
      boxes: this.#boxes,
      pageIndex: this.pageIndex,
      rect,
      rotation: 0,
      text: this.selectedText || "",
    };
  }

  static deserializeFromJSON(data, parent, uiManager) {
    const editor = super.deserialize(data, parent, uiManager);

    const { rect } = data;
    editor.color = data.color;
    editor.#opacity = data.opacity;

    const [pageWidth, pageHeight] = editor.pageDimensions;
    editor.width = (rect[2] - rect[0]) / pageWidth;
    editor.height = (rect[3] - rect[1]) / pageHeight;
    editor.#boxes = data.boxes;
    editor.selectedText = data.text || "";

    editor.#createUnderlines();
    editor.#addToDrawLayer();
    editor.rotate(editor.rotation);
    editor.ignoreNextChangeEvent = true;
    editor.wasAddedFromApi = true;

    return editor;
  }

  static canCreateNewEmptyEditor() {
    return false;
  }
}

export { UnderlineEditor };

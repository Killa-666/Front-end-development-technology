/* ==========================================================================
   AI 助教答疑平台 · 认证页共用交互
   AuthUI：约束校验提示 / 密码显示 / 强度计 / 表单反馈 / 数据序列化
   依赖原生约束校验 API（checkValidity、validity、setCustomValidity）
   ========================================================================== */
window.AuthUI = (function () {
  'use strict';

  var STRENGTH_LABEL = { 0:'未填写', 1:'很弱', 2:'偏弱', 3:'一般', 4:'较强', 5:'很强' };

  /* 按 validity 状态取出该字段应该显示的文案 */
  function text(input, messages) {
    var v = input.validity;
    var map = messages[input.id] || messages[input.name] || {};

    if (v.valueMissing)    return map.valueMissing    || '此项为必填';
    if (v.typeMismatch)    return map.typeMismatch    || '格式不正确';
    if (v.patternMismatch) return map.patternMismatch || '格式不符合要求';
    if (v.tooShort)        return map.tooShort        || '长度不足';
    if (v.tooLong)         return map.tooLong         || '长度超出限制';
    if (v.rangeUnderflow)  return '数值过小';
    if (v.rangeOverflow)   return '数值过大';
    if (v.customError)     return map.customError     || '输入内容无效';
    return '';
  }

  /* 写入字段下方的 .msg 容器（约定：容器 id = 字段 id + Msg） */
  function renderMessage(input, messages) {
    var box = document.getElementById(input.id + 'Msg');
    if (!box) return;
    var msg = text(input, messages);
    box.textContent = msg ? '⚠ ' + msg : '';
    box.classList.toggle('show', !!msg);
    box.classList.toggle('err', !!msg);
  }

  /* 密码显示 / 隐藏 */
  function bindPasswordToggle(input, button) {
    if (!input || !button) return;
    button.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? '隐藏' : '显示';
      button.setAttribute('aria-pressed', String(show));
      input.focus();
    });
  }

  /* 密码强度 → meter 元素 + 右侧文案 */
  function bindStrength(input, meter, label) {
    if (!input || !meter || !label) return;

    function apply() {
      var value = input.value;
      var score = 0;
      if (value.length >= 8)           score++;   // 长度达标
      if (value.length >= 12)          score++;   // 更长再加分
      if (/[a-z]/.test(value))         score++;   // 小写字母
      if (/[A-Z]/.test(value))         score++;   // 大写字母
      if (/\d/.test(value))            score++;   // 数字
      if (/[^A-Za-z0-9]/.test(value))  score++;   // 符号
      score = Math.min(score, 5);

      meter.value = score;
      label.textContent = STRENGTH_LABEL[score];
      label.style.color =
        score >= 4 ? 'var(--ok)' :
        score >= 3 ? 'var(--warn)' :
        score >  0 ? 'var(--err)' : 'var(--ink-3)';
    }

    input.addEventListener('input', apply);
    apply();
  }

  /* 表单统一反馈：实时提示 + 提交汇总 + 校验通过后回调 */
  function bindForm(options) {
    var form    = options.form;
    var messages = options.messages || {};
    var summary = options.summary;
    var onValid = options.onValid;
    var onChange = options.onChange;
    var firstInvalid = null;

    if (!form) return;

    function refresh(target) {
      if (target.matches('input, select, textarea')) renderMessage(target, messages);
      if (onChange) onChange();
    }

    form.addEventListener('input',  function (e) { refresh(e.target); });
    form.addEventListener('change', function (e) { refresh(e.target); });

    /* 用捕获阶段收集第一个不合格的字段 */
    form.addEventListener('invalid', function (e) {
      form.classList.add('was-validated');       // 触发 :invalid 样式
      renderMessage(e.target, messages);
      if (!firstInvalid) firstInvalid = e.target;
    }, true);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.classList.add('was-validated');
      firstInvalid = null;
      if (summary) summary.classList.remove('show');

      if (!form.checkValidity()) {               // 一次跑完所有约束校验
        form.reportValidity();                   // 弹出原生提示并聚焦首个问题项

        var problems = Array.prototype.slice.call(form.elements)
          .filter(function (el) {
            return el.willValidate && el.nodeName !== 'FIELDSET' && !el.validity.valid;
          })
          .map(function (el) { return text(el, messages) || '请检查填写内容'; });

        if (summary) {
          summary.innerHTML = '⚠ 还有 ' + problems.length + ' 处需要修改：<br>· ' +
            problems.filter(function (m, i, arr) { return arr.indexOf(m) === i; })
                    .join('<br>· ');
          summary.classList.add('show');
        }
        (firstInvalid || summary || form).scrollIntoView({ block:'center' });
        return;
      }

      if (onValid) onValid(form);
    });
  }

  /* FormData → 便于展示的对象（同名多值合并成数组） */
  function serialize(form) {
    var data = new FormData(form);
    var out  = {};
    var multi = {};

    data.forEach(function (val, key) {
      if (val instanceof File) {
        out[key] = val.name
          ? val.name + '（' + Math.round(val.size / 1024) + ' KB）'
          : '未选择';
        return;
      }
      if (out[key] === undefined) {
        out[key] = val;
      } else {
        if (!multi[key]) { out[key] = [out[key]]; multi[key] = true; }
        out[key].push(val);
      }
    });

    return out;
  }

  return {
    text: text,
    renderMessage: renderMessage,
    bindPasswordToggle: bindPasswordToggle,
    bindStrength: bindStrength,
    bindForm: bindForm,
    serialize: serialize
  };
})();

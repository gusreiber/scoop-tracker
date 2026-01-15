///////////////////////////////////
// Notification mechanism
// shows result of posts
// designed GIRD forms in mind
//////////////////////////////////

export default class Toast {
  static _el(tag, text='', ...classes) {
    const n = document.createElement(tag);
    if (classes.length) n.classList.add(...classes);
    if(text.length > 0) n.append(text);
    return n;
  }
  static _ensureHost(){
    let TOASTER = document.querySelector('body > .TOASTER'); 
    if(TOASTER) return TOASTER;

    TOASTER = Toast._el('div', '', 'TOASTER');
    document.body.append(TOASTER);
    return TOASTER;
  }

  static addMessage({title='title', message='This event happened', state='OK'}){
    const date    = Date.now();
    const TOASTER = Toast._ensureHost();
    const TOAST   = Toast._el('div', '', 'TOAST', state, 't'+date);
    const H3      = Toast._el('h3', title);
    const P       = Toast._el('p', message);
    const DATE    = Toast._el('spen', new Date(date).toLocaleString(), 'date' );
    const CLOSE   = Toast._el('button', 'x', 'close');

    CLOSE.addEventListener('click', (e)=>{
      e.target.closest('.TOAST').remove();
      Toast.hide();
    });

    TOAST.append(DATE);
    TOAST.append(H3);
    TOAST.append(P);
    TOAST.append(CLOSE);

    TOASTER.append(TOAST);
    TOASTER.classList.add('show');
  }
  static hide(){
    Toast._ensureHost().classList.remove('show');
  }
  static show(){
    Toast._ensureHost().classList.add('show');
  }
  static empty(){
    Toast._ensureHost().replaceChildren();
  }

}
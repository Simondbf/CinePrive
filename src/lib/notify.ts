export const notify = (message: string, title: string = 'Notification') => {
    window.dispatchEvent(new CustomEvent('app-notify', { detail: { title, message } }));
};

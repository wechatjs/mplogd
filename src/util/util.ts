function formatNumber(n: any) {
  n = n.toString();
  return n[1] ? n : '0' + n;
}

export function formatTime(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return [year, month, day].map(formatNumber).join('-') + ' ' + [hour, minute, second].map(formatNumber).join(':');
}

export function resolveUrl(url: string) {
  const link = document.createElement('a');
  link.href = url;
  return link.protocol + '//' + link.host + link.pathname + link.search + link.hash;
}

export function formatDate(time: any) {
  let timeStamp = '';
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(time)) {
    timeStamp += new Date(time).getTime();
  } else if (/^\d{13}$/.test(time)) {
    timeStamp += time;
  } else if (/^\d{10}$/.test(time)) {
    timeStamp += parseInt(time, 10) * 1000;
  }
  return parseInt(timeStamp, 10);
}

export function getLocationCGIName(location) {
  let CGIName;
  if (!!location.match(/\/[A-Za-z]+\?/)) {
    CGIName = location.match(/\/[A-Za-z]+\?/)[0];
    CGIName = CGIName.replace('\?', '').replace('\/', '');
  }
  return CGIName;
}
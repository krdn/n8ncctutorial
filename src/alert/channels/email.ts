/**
 * Email 알림 채널 구현
 * @description SMTP를 통한 이메일 알림 전송 (플레이스홀더)
 *
 * 참고: 실제 이메일 전송은 nodemailer 같은 라이브러리가 필요합니다.
 * 현재는 플레이스홀더로 구현하여 추후 확장 가능하도록 합니다.
 */

import type { AlertMessage, AlertResult, EmailChannelConfig } from '../types.js';

/**
 * 이메일 본문 생성
 * @param message - 알림 메시지
 * @returns HTML 이메일 본문
 */
function buildEmailBody(message: AlertMessage): string {
  const severityColors: Record<string, string> = {
    critical: '#FF0000',
    error: '#DC3545',
    warning: '#FFC107',
    info: '#17A2B8',
  };

  const color = severityColors[message.severity] ?? '#17A2B8';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { background-color: ${color}; color: white; padding: 15px; }
    .content { padding: 20px; }
    .info { background-color: #f5f5f5; padding: 10px; margin: 10px 0; }
    .footer { color: #666; font-size: 12px; padding: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${message.title}</h2>
    <p>Severity: ${message.severity.toUpperCase()}</p>
  </div>
  <div class="content">
    <p>${message.message}</p>
    <div class="info">
      ${message.workflowId ? `<p><strong>Workflow ID:</strong> ${message.workflowId}</p>` : ''}
      ${message.workflowName ? `<p><strong>Workflow Name:</strong> ${message.workflowName}</p>` : ''}
      ${message.executionId ? `<p><strong>Execution ID:</strong> ${message.executionId}</p>` : ''}
      <p><strong>Time:</strong> ${message.timestamp.toISOString()}</p>
    </div>
  </div>
  <div class="footer">
    <p>Sent by n8n Workflow Manager</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 이메일 제목 생성
 * @param message - 알림 메시지
 * @returns 이메일 제목
 */
function buildEmailSubject(message: AlertMessage): string {
  const prefix = `[${message.severity.toUpperCase()}]`;
  return `${prefix} ${message.title}`;
}

/**
 * 이메일로 알림 전송
 * @param message - 알림 메시지
 * @param config - Email 채널 설정
 * @returns 전송 결과
 *
 * 참고: 현재는 플레이스홀더 구현입니다.
 * 실제 이메일 전송을 위해서는 nodemailer 등의 라이브러리가 필요합니다.
 */
export async function sendEmailAlert(
  message: AlertMessage,
  config: EmailChannelConfig
): Promise<AlertResult> {
  // 이메일 전송에 필요한 정보 준비
  const subject = buildEmailSubject(message);
  const body = buildEmailBody(message);
  const recipients = Array.isArray(config.to) ? config.to : [config.to];

  // 플레이스홀더: 실제 전송 없이 준비된 정보 반환
  // 추후 nodemailer 등으로 대체 가능

  // 현재는 이메일 전송 미구현 상태임을 알림
  console.warn('[Email Alert] 이메일 전송 기능은 아직 구현되지 않았습니다.');
  console.warn(`  To: ${recipients.join(', ')}`);
  console.warn(`  Subject: ${subject}`);

  return {
    success: false,
    channel: 'email',
    channelName: config.name,
    error:
      '이메일 전송 기능은 아직 구현되지 않았습니다. nodemailer 설치 후 활성화 필요.',
    response: {
      prepared: true,
      host: config.host,
      port: config.port,
      from: config.from,
      to: recipients,
      subject,
      bodyLength: body.length,
    },
  };
}

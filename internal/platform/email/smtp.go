package email

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"time"
)

type SMTP struct {
	host       string
	port       int
	username   string
	password   string
	from       string
	requireTLS bool
}

func NewSMTP(host string, port int, username, password, from string, requireTLS bool) *SMTP {
	return &SMTP{
		host: host, port: port, username: username, password: password,
		from: from, requireTLS: requireTLS,
	}
}

func (s *SMTP) SendVerification(ctx context.Context, recipient, link string) error {
	from, err := mail.ParseAddress(s.from)
	if err != nil {
		return fmt.Errorf("parse SMTP sender address: %w", err)
	}
	to, err := mail.ParseAddress(recipient)
	if err != nil {
		return fmt.Errorf("parse verification recipient address: %w", err)
	}
	if link == "" {
		return fmt.Errorf("verification link is empty")
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	address := net.JoinHostPort(s.host, strconv.Itoa(s.port))
	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("connect to SMTP server: %w", err)
	}
	stopClose := context.AfterFunc(ctx, func() { _ = conn.Close() })
	defer func() {
		stopClose()
		_ = conn.Close()
	}()
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("start SMTP client: %w", err)
	}
	defer func() { _ = client.Close() }()

	tlsActive := false
	if supported, _ := client.Extension("STARTTLS"); supported {
		tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12, ServerName: s.host}
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("start SMTP TLS: %w", err)
		}
		tlsActive = true
	}
	if s.requireTLS && !tlsActive {
		return fmt.Errorf("SMTP server does not support required STARTTLS")
	}
	if s.username != "" {
		if !tlsActive {
			return fmt.Errorf("refusing SMTP authentication without TLS")
		}
		auth := smtp.PlainAuth("", s.username, s.password, s.host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("authenticate with SMTP server: %w", err)
		}
	}
	if err := client.Mail(from.Address); err != nil {
		return fmt.Errorf("set SMTP sender: %w", err)
	}
	if err := client.Rcpt(to.Address); err != nil {
		return fmt.Errorf("set verification recipient: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("start SMTP message: %w", err)
	}
	message := bytes.NewBuffer(nil)
	fmt.Fprintf(message, "From: %s\r\nTo: %s\r\nSubject: Verify your Scripd email\r\n", from.String(), to.String())
	message.WriteString("MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n")
	fmt.Fprintf(message, "Confirm your email address for Scripd by opening this link:\n\n%s\n\nThis link expires in 24 hours. If you did not create a Scripd account, you can ignore this message.\n", link)
	if _, err := writer.Write(message.Bytes()); err != nil {
		_ = writer.Close()
		return fmt.Errorf("write verification email: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("finish verification email: %w", err)
	}
	if err := client.Quit(); err != nil {
		return fmt.Errorf("close SMTP session: %w", err)
	}
	return nil
}

import { Button, Card, Result, Space, Typography } from 'antd';
import React from 'react';
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router-dom';

function resolveErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText || 'Route Error'}`;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message;
  }
  return 'Unexpected page error. Please retry.';
}

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  const detail = resolveErrorMessage(error);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ width: 'min(720px, 100%)' }}>
        <Result
          status="error"
          title="Page failed to load"
          subTitle={detail}
          extra={
            <Space wrap>
              <Button type="primary" onClick={() => navigate('/')}>
                Go Home
              </Button>
              <Button onClick={() => navigate(-1)}>Go Back</Button>
              <Button onClick={() => window.location.reload()}>Reload</Button>
            </Space>
          }
        />
        <Typography.Text type="secondary">Path: {location.pathname}</Typography.Text>
      </Card>
    </div>
  );
}

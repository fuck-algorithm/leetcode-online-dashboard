import React from 'react';
import { Row, Col, Card, Skeleton } from 'antd';

export const HomeSkeleton: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Hero Section Skeleton */}
      <section style={{
        background: '#FFA116',
        padding: '80px 24px 100px',
        position: 'relative'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Row gutter={[48, 48]} align="middle">
            <Col xs={24} lg={12}>
              <Skeleton.Button active style={{ width: 150, height: 24, marginBottom: 24 }} />
              <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
              <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
                <Skeleton.Button active style={{ width: 120, height: 40 }} />
                <Skeleton.Button active style={{ width: 120, height: 40 }} />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <Card style={{ borderRadius: 8 }}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            </Col>
          </Row>
        </div>
      </section>

      {/* Stats Cards Skeleton */}
      <div style={{ maxWidth: 1200, margin: '-40px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
        <Row gutter={[24, 24]}>
          {[1, 2, 3, 4].map(i => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card style={{ height: 120 }}>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* Chart Skeleton */}
      <div style={{ maxWidth: 1200, margin: '48px auto', padding: '0 24px' }}>
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>

      {/* Ranking Skeleton */}
      <div style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card>
              <Skeleton active paragraph={{ rows: 10 }} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

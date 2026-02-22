import React from 'react';
import { Card, Row, Col, Statistic, Table, Button } from 'antd';
import { StarOutlined, StarFilled } from '@ant-design/icons';
import { useFavorites } from '../context/FavoritesContext';

const Favorites: React.FC = () => {
  const { favorites, removeFavorite } = useFavorites();

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
    },
    {
      title: 'Added',
      dataIndex: 'addedAt',
      key: 'addedAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          icon={<StarFilled />}
          danger
          onClick={() => removeFavorite(record.id)}
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div className="favorites-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Statistic
              title="Favorites"
              value={favorites.length}
              prefix={<StarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="My Favorite Problems">
        <Table
          dataSource={favorites}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default Favorites;

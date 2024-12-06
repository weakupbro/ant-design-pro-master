import React, { useState, useEffect } from 'react';
import { Table, Input, InputNumber, Form, Button, Space, DatePicker, message, Typography, Popconfirm } from 'antd';
import moment from 'moment';
import axios from 'axios'; // 引入 axios

const { Search } = Input;

interface Order {
  id?: number;
  key: string;
  orderNumber: string;
  productName: string;
  orderDate: string | null;
  readyDate: string | null;
  firstShipmentDate: string | null;
  amount: number;
  itemCount: number;
  totalBoxes: number | null;
  unitItems: number | null;
  thisShipment: number | null;
  shipped: number;
  unshipped: number | null;
}

interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
  editing: boolean;
  dataIndex: string;
  title: string;
  inputType: 'number' | 'text' | 'date';
  record: Order;
  index: number;
  children: React.ReactNode;
}

const EditableCell: React.FC<EditableCellProps> = ({
  editing,
  dataIndex,
  title,
  inputType,
  record,
  index,
  children,
  ...restProps
}) => {
  const inputNode = () => {
    if (dataIndex === 'orderDate' || dataIndex === 'readyDate' || dataIndex === 'firstShipmentDate') {
      return <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />;
    }
    if (dataIndex === 'productName' || dataIndex === 'orderNumber') {
      return <Input />;
    }
    if (dataIndex === 'amount') {
      if (!record.id) {
        return <InputNumber style={{ width: '100%' }} min={0} precision={2} />;
      }
      return children;
    }
    return <InputNumber style={{ width: '100%' }} min={0} />;
  };

  const getValidationRules = () => {
    if (dataIndex === 'amount' && record.id) {
      return [];
    }
    if (['orderNumber', 'productName'].includes(dataIndex)) {
      return [{ required: true, message: `请输入${title}` }];
    }
    if (dataIndex === 'amount' && !record.id) {
      return [{ required: true, message: `请输入${title}` }];
    }
    return [];
  };

  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={getValidationRules()}
        >
          {inputNode()}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
};

interface FormattedData {
  orderNumber: any;
  productName: any;
  orderDate: string | null;
  readyDate: string | null;
  firstShipmentDate: string | null;
  amount: number;
  itemCount: number;
  totalBoxes: number;
  unitItems: number;
  thisShipment: number;
  shipped: number;
  unshipped: number;
  [key: string]: any;  // 添加字符串索引签名
}

const EditableTableA: React.FC = () => {
  const [form] = Form.useForm();
  const [editingKey, setEditingKey] = useState<string>('');
  const [data, setData] = useState<Order[]>([
    {
      key: '1',
      orderNumber: 'A001',
      productName: '苹果',
      orderDate: '2024-11-01',
      readyDate: '2024-11-10',
      firstShipmentDate: '2024-11-15',
      amount: 5000,
      itemCount: 100,
      totalBoxes: 20,
      unitItems: 5, // 假设每箱有5件
      thisShipment: 0,
      shipped: 10,
      unshipped: 10, // 正确计算：20 - 10
    },
  ]);
  const [filteredData, setFilteredData] = useState<Order[]>(data);
  const [loading, setLoading] = useState(false);

  const isEditing = (record: Order) => record.key === editingKey;

  const edit = (record: Partial<Order> & { key: string }) => {
    form.setFieldsValue({
      ...record,
      orderDate: record.orderDate ? moment(record.orderDate) : null,
      readyDate: record.readyDate ? moment(record.readyDate) : null,
      firstShipmentDate: record.firstShipmentDate ? moment(record.firstShipmentDate) : null,
    });
    setEditingKey(record.key);
  };

  const cancel = () => {
    setEditingKey('');
  };

  const validateShipment = (record: any, row: any) => {
    const totalBoxes = Number(row.totalBoxes) || Number(record.totalBoxes) || 0;
    const currentShipped = Number(record.shipped) || 0;
    const thisShipment = Number(row.thisShipment) || 0;
    const newShipped = currentShipped + thisShipment;

    if (newShipped > totalBoxes) {
      message.error(`发货数量超过总箱数！总箱数: ${totalBoxes}, 已发货: ${currentShipped}, 本次发货: ${thisShipment}`);
      return false;
    }
    return true;
  };

  const validateFields = (row: any, isEditing: boolean = false) => {
    // 验证订单号
    if (!row.orderNumber?.trim()) {
      message.error('订单号不能为空');
      return false;
    }

    // 验证产品名称
    if (!row.productName?.trim()) {
      message.error('产品名称不能为空');
      return false;
    }

    // 只在新建记录时验证金额
    if (!isEditing) {
      const amount = Number(row.amount);
      if (isNaN(amount) || amount <= 0) {
        message.error('金额必须大于0');
        return false;
      }
    }

    // 验证数量
    const itemCount = Number(row.itemCount);
    if (isNaN(itemCount) || itemCount <= 0) {
      message.error('数量必须大于0');
      return false;
    }

    // 验证箱数
    const totalBoxes = Number(row.totalBoxes);
    if (isNaN(totalBoxes) || totalBoxes <= 0) {
      message.error('箱数必须大于0');
      return false;
    }

    return true;
  };

  const save = async (key: string) => {
    try {
      const row = await form.validateFields();
      console.log('表单数据:', row);
      
      const newData = [...data];
      const index = newData.findIndex((item) => key === item.key);
      
      if (index > -1) {
        const item = newData[index];
        console.log('当前记录:', item);
        
        // 验证字段，传入是否为编辑模式的标志
        if (!validateFields(row, !!item.id)) {
          return;
        }

        // 验证发货数量
        if (!validateShipment(item, row)) {
          return;
        }

        // 计算发货相关数量
        const currentShipped = Number(item.shipped) || 0;
        const thisShipment = Number(row.thisShipment) || 0;
        const newShipped = currentShipped + thisShipment;
        const totalBoxes = Number(row.totalBoxes) || Number(item.totalBoxes) || 0;
        
        console.log('发货数量计算:', {
          currentShipped,
          thisShipment,
          newShipped,
          totalBoxes
        });
        
        // 格式化数据
        const formattedData: FormattedData = {
          orderNumber: row.orderNumber.trim(),
          productName: row.productName.trim(),
          orderDate: row.orderDate ? moment(row.orderDate).format('YYYY-MM-DD') : null,
          readyDate: row.readyDate ? moment(row.readyDate).format('YYYY-MM-DD') : null,
          firstShipmentDate: row.firstShipmentDate ? moment(row.firstShipmentDate).format('YYYY-MM-DD') : null,
          amount: item.id ? Number(item.amount) : Number(row.amount || 0), // 如果是编辑已有记录，保持原有金额
          itemCount: Number(row.itemCount || 0),
          totalBoxes: totalBoxes,
          unitItems: Number(row.unitItems || 0),
          thisShipment: thisShipment,
          shipped: newShipped,
          unshipped: totalBoxes - newShipped
        };

        console.log('发送到服务器的数据:', formattedData);

        try {
          if (item.id) {
            // 更新现有记录
            const response = await axios.put(`http://localhost:3003/tablea/${item.id}`, formattedData);
            console.log('服务器响应:', response.data);
            
            if (response.data) {
              const updatedItem: Order = {
                ...formattedData,
                id: item.id,
                key: item.key
              };
              console.log('更新后的记录:', updatedItem);
              
              newData[index] = updatedItem;
              setData(newData);
              setFilteredData(newData);
              setEditingKey('');
              message.success('更新成功');
            }
          } else {
            // 创建新记录
            const response = await axios.post('http://localhost:3003/tablea', formattedData);
            if (response.data) {
              const newRecord = {
                ...formattedData,
                id: response.data.id,
                key: response.data.id.toString()
              };
              newData.unshift(newRecord);
              setData(newData);
              setFilteredData(newData);
              setEditingKey('');
              message.success('创建成功');
            }
          }
        } catch (error) {
          console.error('保存失败:', error);
          message.error('保存失败，请重试');
        }
      }
    } catch (errInfo) {
      console.error('验证失败:', errInfo);
    }
  };

  const addRow = () => {
    const newRow: Order = {
      key: `${Date.now()}`,
      orderNumber: '',
      productName: '',
      orderDate: null,
      readyDate: null,
      firstShipmentDate: null,
      amount: 0,
      itemCount: 0,
      totalBoxes: 0,
      unitItems: 0,
      thisShipment: 0,
      shipped: 0,
      unshipped: 0
    };
    const newData = [newRow, ...data];
    setData(newData);
    setFilteredData(newData);
    edit(newRow);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3003/tablea');
      const formattedData = response.data
        .map((item: any) => ({
          ...item,
          key: item.id.toString(),
          orderDate: item.orderDate ? moment(item.orderDate).format('YYYY-MM-DD') : null,
          readyDate: item.readyDate ? moment(item.readyDate).format('YYYY-MM-DD') : null,
          firstShipmentDate: item.firstShipmentDate ? moment(item.firstShipmentDate).format('YYYY-MM-DD') : null,
          amount: Number(item.amount),
          itemCount: Number(item.itemCount),
          totalBoxes: Number(item.totalBoxes),
          unitItems: Number(item.unitItems),
          thisShipment: 0,
          shipped: Number(item.shipped),
          unshipped: Number(item.unshipped)
        }))
        .sort((a: any, b: any) => b.id - a.id);
      
      setData(formattedData);
      setFilteredData(formattedData);
    } catch (error: any) {
      console.error('载数据失败:', error);
      message.error(`加载数据失败: ${error.response?.data?.message || '请重试'}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (key: string) => {
    try {
      const record = data.find(item => item.key === key);
      if (record) {
        // 删除 A 表格记录
        await axios.delete(`http://localhost:3003/tablea/${key}`);
        
        // 同步删除 B 表格中对应的记录
        try {
          const responseB = await axios.get(`http://localhost:3003/OrderB/byOrderNumber/${record.orderNumber}`);
          if (responseB.data) {
            await axios.delete(`http://localhost:3003/OrderB/${responseB.data.id}`);
          }
        } catch (error) {
          console.error('同步删除 B 表格录失败:', error);
        }
        
        await fetchData();
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleSearch = (value: string) => {
    const searchData = data.filter(
      (item) =>
        item.orderNumber.toLowerCase().includes(value.toLowerCase()) ||
        item.productName.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredData(searchData);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3003/tablea');
      const ordersWithKeys = response.data.map((order: any) => ({
        ...order,
        key: order.id.toString(),
        orderDate: order.orderDate ? moment(order.orderDate).format('YYYY-MM-DD') : '',
        readyDate: order.readyDate ? moment(order.readyDate).format('YYYY-MM-DD') : '',
        firstShipmentDate: order.firstShipmentDate ? moment(order.firstShipmentDate).format('YYYY-MM-DD') : '',
      }));
      setData(ordersWithKeys);
      setFilteredData(ordersWithKeys);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 添加删除功能
  const handleDelete = async (record: Order) => {
    try {
      if (record.id) {
        await axios.delete(`http://localhost:3003/tablea/${record.id}`);
        const newData = data.filter(item => item.id !== record.id);
        setData(newData);
        setFilteredData(newData);
        message.success('删除成功');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败，请重试');
    }
  };

  // 添加搜索功能
  const onSearch = (value: string) => {
    const filtered = data.filter(item => 
      item.orderNumber.toLowerCase().includes(value.toLowerCase()) ||
      item.productName.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredData(filtered);
  };

  // 添加数据加载
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:3003/tablea');
        const formattedData = response.data.map((item: any) => ({
          ...item,
          key: item.id.toString(),
        }));
        setData(formattedData);
        setFilteredData(formattedData);
      } catch (error) {
        console.error('获取数据失败:', error);
        message.error('获取数失败');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const columns = [
    {
      title: '订单号',
      dataIndex: 'orderNumber',
      width: 120,
      fixed: 'left' as const,
      editable: true,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 150,
      editable: true,
    },
    {
      title: '订单日期',
      dataIndex: 'orderDate',
      width: 120,
      editable: true,
      render: (date: string) => date ? moment(date).format('YYYY-MM-DD') : null,
    },
    {
      title: '货好日期',
      dataIndex: 'readyDate',
      width: 120,
      editable: true,
      render: (date: string) => date ? moment(date).format('YYYY-MM-DD') : null,
    },
    {
      title: '首发货日期',
      dataIndex: 'firstShipmentDate',
      width: 120,
      editable: true,
      render: (date: string) => date ? moment(date).format('YYYY-MM-DD') : null,
    },
    {
      title: '总金额',
      dataIndex: 'amount',
      width: 100,
      editable: (record: Order) => !record.id,
      render: (amount: any) => {
        const numAmount = Number(amount);
        return !isNaN(numAmount) ? numAmount.toFixed(2) : '0.00';
      },
    },
    {
      title: '总数量',
      dataIndex: 'itemCount',
      width: 100,
      editable: true,
    },
    {
      title: '总箱数',
      dataIndex: 'totalBoxes',
      width: 100,
      editable: true,
    },
    {
      title: '单位数量',
      dataIndex: 'unitItems',
      width: 100,
      editable: true,
    },
    {
      title: '本次发货',
      dataIndex: 'thisShipment',
      width: 100,
      editable: true,
    },
    {
      title: '已发货',
      dataIndex: 'shipped',
      width: 100,
      editable: false,
    },
    {
      title: '未发货',
      dataIndex: 'unshipped',
      width: 100,
      editable: false,
    },
    {
      title: '操作',
      dataIndex: 'operation',
      fixed: 'right' as const,
      width: 150,
      render: (_: any, record: Order) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <Typography.Link onClick={() => save(record.key)} style={{ marginRight: 8 }}>
              保存
            </Typography.Link>
            <Popconfirm title="确定取消?" onConfirm={cancel}>
              <a>取消</a>
            </Popconfirm>
          </span>
        ) : (
          <Space>
            <Typography.Link disabled={editingKey !== ''} onClick={() => edit(record)}>
              编辑
            </Typography.Link>
            <Popconfirm title="确定除?" onConfirm={() => handleDelete(record)}>
              <a>删除</a>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const mergedColumns = columns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record: Order) => ({
        record,
        inputType: col.dataIndex === 'orderDate' || col.dataIndex === 'readyDate' || col.dataIndex === 'firstShipmentDate'
          ? 'date'
          : col.dataIndex === 'amount' || col.dataIndex === 'itemCount' || col.dataIndex === 'totalBoxes' || 
            col.dataIndex === 'unitItems' || col.dataIndex === 'thisShipment' || col.dataIndex === 'shipped' || 
            col.dataIndex === 'unshipped'
          ? 'number'
          : 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record) && (typeof col.editable === 'function' ? col.editable(record) : !!col.editable),
      }),
    };
  });

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={addRow} type="primary">
          添加新行
        </Button>
        <Search
          placeholder="搜索订单号或产品名称"
          onSearch={onSearch}
          style={{ width: 200 }}
        />
      </Space>
      <Form form={form} component={false}>
        <Table
          components={{
            body: {
              cell: EditableCell,
            },
          }}
          bordered
          dataSource={filteredData}
          columns={mergedColumns}
          rowClassName="editable-row"
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Form>
    </div>
  );
};

export default EditableTableA;

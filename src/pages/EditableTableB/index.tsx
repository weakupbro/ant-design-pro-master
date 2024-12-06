import React, { useState, useEffect, useRef } from 'react';
import { Table, Input, InputNumber, Form, Button, Space, DatePicker, Upload, message, Typography, Popconfirm } from 'antd';
import { UploadOutlined, SearchOutlined } from '@ant-design/icons';
import moment, { Moment } from 'moment';
import axios, { AxiosError } from 'axios';
import { request } from '@umijs/max';
import type { ColumnType } from 'antd/es/table';
import type { Key } from 'react';
import type { UploadProps, UploadFile } from 'antd/es/upload/interface';

const { Search } = Input;

interface OrderB {
  key: string;
  id: number;
  orderNumber: string;
  productName: string;
  orderDate: string;
  totalAmount: number;
  currentPayment: number;
  paidAmount: number;
  unpaidAmount: number;
  paymentType: string;
  updateTime: string;
  orderScreenshot?: string;
}

interface ExistingOrder {
  id: number;
  updateTime: number;
}

interface TableItem {
  id: number;
  orderNumber: string;
  orderDate: string;
  productName: string;
  amount: number | string;
}

interface BTableOrder {
  id: number;
  orderNumber: string;
  orderDate: string;
  productName: string;
  amount: number;
  currentPayment: number;
  paidAmount: number;
  unpaidAmount: number;
  paymentType: string;
  updateTime: number;
  orderScreenshot: string | null;
}

interface EditableColumnType<T> extends Omit<ColumnType<T>, 'onCell'> {
  editable?: boolean;
  inputType?: 'number' | 'text';
  onCell?: (record: T) => {
    style: React.CSSProperties;
    editing: boolean;
    inputType: 'number' | 'text';
    dataIndex: string | undefined;
    title: any;
    record: T;
  };
}

interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
  editing: boolean;
  dataIndex: string;
  title: any;
  inputType: 'number' | 'text';
  record: OrderB;
  index: number;
  children: React.ReactNode;
}

const EditableTableB: React.FC = () => {
  const [form] = Form.useForm();
  const [editingKey, setEditingKey] = useState<string>('');
  const [data, setData] = useState<OrderB[]>([]);
  const [filteredData, setFilteredData] = useState<OrderB[]>([]);
  const [searchText, setSearchText] = useState('');

  const dataRef = useRef<OrderB[]>([]);

  const isEditing = (record: OrderB) => record.key === editingKey;

  const edit = (record: Partial<OrderB> & { key: string }) => {
    if (record.unpaidAmount === 0) {
      message.error('未付款金额为0，已付清无需再付款');
      return;
    }
    
    const totalAmount = Number(record.paidAmount || '0') + Number(record.unpaidAmount || '0');
    const expectedPayment = getExpectedPayment(record);
    
    form.setFieldsValue({
      ...record,
      orderDate: record.orderDate ? moment(record.orderDate) : null,
      currentPayment: expectedPayment
    });
    setEditingKey(record.key);
  };

  const cancel = () => {
    setEditingKey('');
  };

  const fetchData = async () => {
    try {
      const response = await axios.get('http://localhost:3003/tableb');
      
      if (!Array.isArray(response.data)) {
        console.error('返回的数据不是数组格式:', response.data);
        return;
      }

      const formattedData = response.data
        .map((item: any) => ({
          id: item.id,
          key: item.id.toString(),
          orderNumber: item.orderNumber,
          productName: item.productName,
          orderDate: item.orderDate,
          totalAmount: parseFloat(item.totalAmount || '0'),
          currentPayment: parseFloat(item.currentPayment || '0'),
          paidAmount: parseFloat(item.paidAmount || '0'),
          unpaidAmount: parseFloat(item.unpaidAmount || '0'),
          paymentType: item.paymentType,
          updateTime: item.updateTime
        }))
        .sort((a: any, b: any) => b.id - a.id);
      
      setData(formattedData);
      setFilteredData(formattedData);
      console.log('数据获取成功:', formattedData);
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败，请检查网络连接');
    }
  };

  const checkAndSyncWithTableA = async () => {
    try {
      console.log('开始同步检查...');
      const [tableAData, tableBData] = await Promise.all([
        axios.get('http://localhost:3003/tablea'),
        axios.get('http://localhost:3003/tableb')
      ]);

      if (!Array.isArray(tableAData.data) || !Array.isArray(tableBData.data)) {
        console.error('返回的数据格式不正确');
        return;
      }

      const existingOrderMap = new Map(
        tableBData.data.map((item: any) => [item.orderNumber.trim(), item])
      );
      
      for (const itemA of tableAData.data) {
        const orderNumberA = itemA.orderNumber.trim();
        const existingOrder = existingOrderMap.get(orderNumberA);

        if (!existingOrder) {
          try {
            const totalAmount = parseFloat(itemA.amount);
            const newOrder = {
              orderNumber: orderNumberA,
              productName: itemA.productName,
              orderDate: itemA.orderDate,
              totalAmount: totalAmount,
              currentPayment: 0,
              paidAmount: 0,
              paymentType: '定金',
              unpaidAmount: totalAmount,
              updateTime: Date.now()
            };
            
            await axios.post('http://localhost:3003/tableb', newOrder);
            console.log('同步新订单成功:', orderNumberA);
          } catch (error) {
            console.error('同步单条记录失败:', error);
          }
        } else {
          try {
            const updatedOrder = {
              ...existingOrder,
              productName: itemA.productName,
              orderDate: itemA.orderDate,
              totalAmount: parseFloat(itemA.amount),
              updateTime: Date.now()
            };
            
            await axios.put(`http://localhost:3003/tableb/${existingOrder.id}`, updatedOrder);
            console.log('更新现有订单成功:', orderNumberA);
          } catch (error) {
            console.error('更新现有记录失败:', error);
          }
        }
      }
      
      await fetchData();
      console.log('同步完成');
    } catch (error) {
      console.error('同步失败:', error);
      message.error('同步失败，请检查网络连接');
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        console.log('开始初始化B表数据...');
        await fetchData();  // 先尝试获
        console.log('B表数据加载完成，检查同');
        await checkAndSyncWithTableA();  // 然后检查同步
      } catch (error) {
        console.error('初始化数据失败:', error);
      }
    };

    initData();

    // 设置定时同步
    const syncInterval = setInterval(async () => {
      console.log('行定时同步检查...');
      await checkAndSyncWithTableA();
    }, 30000);

    return () => clearInterval(syncInterval);
  }, []);

  // 添加一个手动刷新方法
  const refreshData = async () => {
    try {
      console.log('手动刷新据...');
      await fetchData();
      console.log('数据刷新完成');
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  };

  const isValidCurrentPayment = (currentPayment: number, paidAmount: number, totalAmount: number): boolean => {
    // 四舍五入到两位小数
    const roundToTwo = (num: number) => Math.round(num * 100) / 100;
    
    // 计算期望款金额
    const expectedPayment30 = roundToTwo(totalAmount * 0.3);
    const expectedPayment40 = roundToTwo(totalAmount * 0.4);
    
    // 计算已付款金额（四舍五入）
    const roundedPaidAmount = roundToTwo(paidAmount);
    const roundedCurrentPayment = roundToTwo(currentPayment);

    console.log('验证付款额:', {
      currentPayment: roundedCurrentPayment,
      paidAmount: roundedPaidAmount,
      totalAmount,
      expectedPayment30,
      expectedPayment40
    });
    
    // 使用一个小的误差范围行比较
    const EPSILON = 0.01;
    
    // 检查是否是首次付款（30%）
    if (roundedPaidAmount === 0 && Math.abs(roundedCurrentPayment - expectedPayment30) < EPSILON) {
      return true;
    }
    
    // 检查是否是第二次付款（30%
    if (Math.abs(roundedPaidAmount - expectedPayment30) < EPSILON && 
        Math.abs(roundedCurrentPayment - expectedPayment30) < EPSILON) {
      return true;
    }
    
    // 检查是否是最后付款（40%）
    if (Math.abs(roundedPaidAmount - roundToTwo(totalAmount * 0.6)) < EPSILON && 
        Math.abs(roundedCurrentPayment - expectedPayment40) < EPSILON) {
      return true;
    }
    
    return false;
  };

  const getPaymentType = (paidAmount: number, totalAmount: number): string => {
    const EPSILON = 0.01;  // 允许0.01的误差
    const ratio = paidAmount / totalAmount;
    
    const isClose = (a: number, b: number) => Math.abs(a - b) < EPSILON;
    
    if (isClose(ratio, 0)) return '定金';
    if (isClose(ratio, 0.3)) return '首发款';
    if (isClose(ratio, 0.6)) return '余款';
    if (isClose(ratio, 1)) return '已';
    return '金';  // 为定金
  };

  // 添加一个函数来修正款类型
  const correctPaymentType = (currentPayment: number, paidAmount: number, totalAmount: number): string => {
    const roundToTwo = (num: number) => Math.round(num * 100) / 100;
    const newPaidAmount = roundToTwo(Number(paidAmount) + Number(currentPayment));
    return getPaymentType(newPaidAmount, totalAmount);
  };

  const getCurrentPaymentTip = (paidAmount: number, totalAmount: number): string => {
    // 四舍五入到两位小数
    const roundToTwo = (num: number) => Math.round(num * 100) / 100;
    const EPSILON = 0.01;
    
    const roundedPaidAmount = roundToTwo(paidAmount);
    const expectedPayment30 = roundToTwo(totalAmount * 0.3);
    const expectedPayment40 = roundToTwo(totalAmount * 0.4);
    const expectedPayment60 = roundToTwo(totalAmount * 0.6);
    
    if (roundedPaidAmount === 0) {
      return `本次付款金额必须为订单金额的30%，即：¥${expectedPayment30.toFixed(2)}`;
    }
    if (Math.abs(roundedPaidAmount - expectedPayment30) < EPSILON) {
      return `本次付款金额必须为订单金额的30%，即：¥${expectedPayment30.toFixed(2)}`;
    }
    if (Math.abs(roundedPaidAmount - expectedPayment60) < EPSILON) {
      return `本次付款金额必须订金额的40%，即：¥${expectedPayment40.toFixed(2)}`;
    }
    return '已付清，无需再付款';
  };

  // 化数字，最多保留两小数
  const formatNumber = (num: number) => {
    const str = num.toString();
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length > 2) {
      return Number(num.toFixed(2));
    }
    return num;
  };

  // 全的数字换函数
  const safeParseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '');
      const num = Number(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const getExpectedPayment = (record: Partial<OrderB>): number => {
    const totalAmount = Number(record.totalAmount || '0');
    const paidAmount = Number(record.paidAmount || '0');
    const EPSILON = 0.01;
    
    const ratio = paidAmount / totalAmount;
    const isClose = (a: number, b: number) => Math.abs(a - b) < EPSILON;
    
    // 根据已付金额判断当前阶段应付额
    if (isClose(ratio, 0)) {  // 未付款，应付定金
      return Number((totalAmount * 0.3).toFixed(2));
    } else if (isClose(ratio, 0.3)) {  // 已付定金，应付首发款
      return Number((totalAmount * 0.3).toFixed(2));
    } else if (isClose(ratio, 0.6)) {  // 已付首发款，
      return Number((totalAmount * 0.4).toFixed(2));
    }
    return 0;
  };

  const validatePayment = (record: OrderB, currentPayment: number) => {
    const totalAmount = record.totalAmount;
    const paidAmount = Number(record.paidAmount || '0');
    const EPSILON = 0.01;  // 允许0.01的误差
    
    // 验证小数位数
    if (!Number.isInteger(currentPayment)) {
      const decimalPart = currentPayment.toString().split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        message.error('付款金额最多只能有两位小数');
        return false;
      }
    }

    const ratio = paidAmount / totalAmount;
    const newRatio = (paidAmount + currentPayment) / totalAmount;
    const isClose = (a: number, b: number) => Math.abs(a - b) < EPSILON;

    // 验证付款额是否符合当前阶段
    if (isClose(ratio, 0) && !isClose(newRatio, 0.3)) {
      message.error(`定金阶段应支付订单金额的30%，即：¥${(totalAmount * 0.3).toFixed(2)}`);
      return false;
    } else if (isClose(ratio, 0.3) && !isClose(newRatio, 0.6)) {
      message.error(`首发款阶段应支付订单金额的30%，即：¥${(totalAmount * 0.3).toFixed(2)}`);
      return false;
    } else if (isClose(ratio, 0.6) && !isClose(newRatio, 1)) {
      message.error(`款��应支付订单金额的40%即：¥${(totalAmount * 0.4).toFixed(2)}`);
      return false;
    }

    return true;
  };

  // 修改 save 函数
const save = async (key: string) => {
  try {
    const row = (await form.validateFields()) as OrderB;
    const newData = [...data];
    const index = newData.findIndex(item => key === item.key);
    
    if (index > -1) {
      const item = newData[index];
      const currentPayment = Number(row.currentPayment || 0);
      const paidAmount = Number(item.paidAmount || 0);
      const totalAmount = paidAmount + Number(item.unpaidAmount || 0);
      
      console.log('保存前数据:', {
        currentPayment,
        paidAmount,
        totalAmount,
        item
      });
      
      // 验证付款金额
      if (!validatePayment(item, currentPayment)) {
        return;
      }
      
      // 计算新的已付金额和未付金额
      const newPaidAmount = paidAmount + currentPayment;
      const newUnpaidAmount = totalAmount - newPaidAmount;
      
      // 确定新的付款类型
      const newPaymentType = correctPaymentType(currentPayment, paidAmount, totalAmount);

      // 更新数据
      const updateData = {
        currentPayment,
        paidAmount: newPaidAmount,
        unpaidAmount: newUnpaidAmount,
        paymentType: newPaymentType
      };

      console.log('备发送求:', {
        id: item.id,
        updateData
      });

      try {
        // 发送更新请求到务器
        const response = await axios.put(`http://localhost:3003/tableb/${item.id}`, updateData);
        console.log('服务器响应:', response.data);
        
        // 更新本地数据
        const updatedItem = { ...item, ...updateData };
        newData.splice(index, 1, updatedItem);
        setData(newData);
        setFilteredData(newData);
        setEditingKey('');
        
        message.success('付款信息更新成功');
        
        // 刷新数据
        await fetchData();
      } catch (error: unknown) {
        if (error instanceof AxiosError) {
          console.error('更新失败:', {
            error,
            response: error.response?.data,
            status: error.response?.status
          });
          message.error(error.response?.data?.message || '更新失败，请重试');
        } else {
          console.error('更新失败:', error);
          message.error('更新失败，请重试');
        }
      }
    }
  } catch (errInfo) {
    console.error('保存失败:', errInfo);
    message.error('保存失败，请检查输入');
  }
};

  const handleSearch = (value: string) => {
    setSearchText(value);
    const filtered = data.filter(item => 
      item.orderNumber.toLowerCase().includes(value.toLowerCase()) || 
      item.productName.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredData(filtered);
  };

  const calculatePaymentAmount = (paymentType: string) => {
    const maxAmount = 5000;
    if (paymentType === '定金' || paymentType === '首发款') {
      return maxAmount * 0.3;
    } else if (paymentType === '余款') {
      return maxAmount * 0.4;
    } else {
      return 0;
    }
  };

  // 付款类型筛选选项
  const paymentTypeFilters = [
    { text: '定金', value: '定金' },
    { text: '首发款', value: '首发' },
    { text: '余款', value: '余款' },
    { text: '已清', value: '已付清' }
  ];

  useEffect(() => {
    setFilteredData(data);
  }, [data]);

  const handleUpload = async (fileNames: string, record: OrderB) => {
    try {
      console.log('开始更新记录:', {
        id: record.id,
        fileNames
      });
      await axios.put(`http://localhost:3003/tableb/${record.id}`, {
        ...record,
        orderScreenshot: fileNames
      });
      fetchData();
      message.success('文件更新成功');
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    }
  };

  // 定义可���辑单元格组件
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
    const inputNode = inputType === 'number' ? (
      <InputNumber
        min={0}
        precision={2}
        style={{ width: '100%' }}
      />
    ) : (
      <Input />
    );

    return (
      <td {...restProps}>
        {editing ? (
          <Form.Item
            name={dataIndex}
            style={{ margin: 0 }}
            rules={[
              {
                required: dataIndex === 'currentPayment',
                message: `请输入${title}`,
              },
            ]}
          >
            {inputNode}
          </Form.Item>
        ) : (
          children
        )}
      </td>
    );
  };

  const columns: EditableColumnType<OrderB>[] = [
    {
      title: '订单号',
      dataIndex: 'orderNumber',
      width: '12%',
      editable: false,
      fixed: 'left' as const,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: '15%',
      editable: false,
    },
    {
      title: '下单日期',
      dataIndex: 'orderDate',
      width: '12%',
      editable: false,
      render: (date: string) => date ? moment(date).format('YYYY-MM-DD') : '',
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      width: '10%',
      editable: false,
      render: (amount: number) => amount?.toFixed(2),
    },
    {
      title: '本次付款',
      dataIndex: 'currentPayment',
      width: '10%',
      editable: true,
      inputType: 'number',
    },
    {
      title: '已付金额',
      dataIndex: 'paidAmount',
      width: '10%',
      editable: false,
      render: (amount: number) => amount?.toFixed(2),
    },
    {
      title: '未付金额',
      dataIndex: 'unpaidAmount',
      width: '10%',
      editable: false,
      render: (amount: number) => amount?.toFixed(2),
    },
    {
      title: '应付款金额',
      dataIndex: 'expectedPayment',
      width: '10%',
      editable: false,
      render: (_: any, record: OrderB) => {
        const expectedPayment = getExpectedPayment(record);
        return expectedPayment.toFixed(2);
      },
    },
    {
      title: '应付款类型',
      dataIndex: 'paymentType',
      width: '10%',
      editable: false,
      filters: [
        { text: '定金', value: '定金' },
        { text: '首发款', value: '首发款' },
        { text: '余款', value: '余款' },
        { text: '已付清', value: '已付清' },
      ],
      onFilter: (value: boolean | Key, record: OrderB) => record.paymentType === value.toString(),
    },
    {
      title: '订单截图',
      dataIndex: 'orderScreenshot',
      width: '20%',
      editable: false,
      render: (_: any, record: OrderB) => {
        const uploadProps: UploadProps = {
          name: 'file',
          action: 'http://localhost:3003/upload',
          showUploadList: false,
          beforeUpload: (file) => {
            console.log('准备上传文件:', file);
            const isImage = file.type.startsWith('image/');
            if (!isImage) {
              message.error('只能上传图片文件！');
              return false;
            }
            const isLt5M = file.size / 1024 / 1024 < 5;
            if (!isLt5M) {
              message.error('图片大小不能超过5MB！');
              return false;
            }
            return true;
          },
          onChange(info) {
            const { status, response, name } = info.file;
            
            console.log('文件上传状态变化:', {
              status,
              name,
              response
            });

            if (status === 'uploading') {
              console.log('文件上传中...');
            } else if (status === 'done') {
              if (response && response.success) {
                console.log('上传成功:', response);
                message.success(`${name} 上传成功`);
                const newFileName = response.fileName;
                const currentFiles = record.orderScreenshot ? record.orderScreenshot.split(',') : [];
                const updatedFiles = [...currentFiles, newFileName].join(',');
                handleUpload(updatedFiles, record);
              } else {
                console.error('上传失败:', response);
                message.error(response?.message || '上传失败');
              }
            } else if (status === 'error') {
              console.error('上传错误:', {
                file: info.file,
                error: info.file.error,
                response: response
              });
              message.error(response?.message || '上传失败，请重试');
            }
          }
        };

        const handleDelete = (fileToDelete: string) => {
          if (!record.orderScreenshot) return;
          console.log('删除文件:', fileToDelete);
          const currentFiles = record.orderScreenshot.split(',');
          const updatedFiles = currentFiles.filter(file => file !== fileToDelete).join(',');
          handleUpload(updatedFiles, record);
        };

        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {record.orderScreenshot && record.orderScreenshot.split(',').map((file, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                <span>{file.split('-').slice(1).join('-')}</span>
                <a 
                  onClick={() => handleDelete(file)} 
                  style={{ marginLeft: '4px', color: '#ff4d4f' }}
                >
                  删除
                </a>
              </div>
            ))}
            <Upload {...uploadProps}>
              <a>
                <UploadOutlined /> 上传
              </a>
            </Upload>
          </div>
        );
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      width: '15%',
      editable: false,
      render: (date: string) => date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '',
    },
    {
      title: '操作',
      dataIndex: 'operation',
      width: '8%',
      fixed: 'right' as const,
      render: (_: any, record: OrderB) => {
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
          <Typography.Link disabled={editingKey !== ''} onClick={() => edit(record)}>
            编辑
          </Typography.Link>
        );
      },
    },
  ];

  const mergedColumns = columns.map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record: OrderB) => ({
        record,
        inputType: col.inputType || 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Search
            placeholder="搜索订号"
            onSearch={(value) => handleSearch(value)}
            style={{ width: 200 }}
          />
          <Search
            placeholder="搜索产品名称"
            onSearch={(value) => handleSearch(value)}
            style={{ width: 200 }}
          />
          <Button onClick={refreshData} type="primary">
            刷新
          </Button>
        </Space>
      </div>
      <Form form={form} component={false}>
        <Table
          components={{
            body: {
              cell: EditableCell as any,
            },
          }}
          bordered
          dataSource={filteredData}
          columns={mergedColumns as unknown as ColumnType<OrderB>[]}
          rowClassName="editable-row"
          pagination={false}
          scroll={{ x: 1500 }}
        />
      </Form>
    </div>
  );
};

export default EditableTableB;


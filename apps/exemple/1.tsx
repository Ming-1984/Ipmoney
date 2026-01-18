import React, { useState } from 'react';
import { 
  Search, 
  ShieldCheck, 
  TrendingUp, 
  Handshake, 
  User, 
  Home, 
  Layers, 
  ChevronRight, 
  Star, 
  ArrowRightLeft,
  Award,
  Moon,
  Trophy,
  Map,
  Building2,
  Sparkles
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('home');
  // 获取应用ID
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // 模拟专利数据
  const patents = [
    { id: 1, title: '一种高强度航空铝合金制备方法', type: '发明专利', price: '￥150,000', industry: '新材料', hot: true },
    { id: 2, title: '智能无人机避障感知系统', type: '实用新型', price: '￥88,000', industry: '人工智能', hot: false },
    { id: 3, title: '新型柔性显示屏封装结构', type: '发明专利', price: '￥220,000', industry: '半导体', hot: true },
  ];

  const renderHome = () => (
    <div className="pb-24">
      {/* 顶部“专利点金台”画框区域 - 仅修改此部分 */}
      <div className="px-4 pt-6 pb-4 bg-white sticky top-0 z-10">
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-50/80 via-white to-white rounded-[40px] p-6 shadow-[0_20px_50px_rgba(255,145,0,0.05)] border border-orange-50/50">
          {/* 背景装饰：去除疲劳感的柔光 */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/20 blur-3xl -mr-10 -mt-10 rounded-full"></div>
          
          {/* 上部：品牌名称与动画头像 */}
          <div className="relative z-10 flex justify-between items-end mb-6">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                <h1 className="text-3xl font-black tracking-tight text-gray-900 leading-none">
                  IP<span className="text-orange-600">MONEY</span>
                </h1>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className="text-[11px] font-bold text-gray-400 tracking-[0.4em] uppercase">专利点金台</span>
                <Sparkles size={10} className="text-orange-400 opacity-60" />
              </div>
            </div>

            {/* 头像动画 - 更加开放的设计 */}
            <div className="relative group">
              <div className="absolute inset-0 bg-orange-400 rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <video
                src={`/artifacts/${appId}/public/data/ffae5f74c129b5658e626d2705a7063d.mp4`}
                className="w-14 h-14 rounded-full object-cover border-[3px] border-white shadow-2xl relative z-10"
                autoPlay
                loop
                muted
                playsInline
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-white rounded-full z-20 flex items-center justify-center shadow-sm">
                <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* 下部：搜索栏 - 采用无界感设计 */}
          <div className="relative z-10">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search size={18} className="text-orange-500/70" />
            </div>
            <input 
              type="text" 
              placeholder="寻找能够点石成金的创新技术..." 
              className="w-full bg-white/60 backdrop-blur-md border border-gray-100 rounded-[24px] py-4 pl-14 pr-6 text-sm outline-none focus:bg-white focus:border-orange-200 focus:ring-4 focus:ring-orange-500/5 transition-all placeholder:text-gray-300 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* 以下部分保持原样 */}
      {/* Hero Banner - 体现价值转化 */}
      <div className="px-4 py-2">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-600 p-6 text-white shadow-xl shadow-orange-100">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-1">点石成金，成就价值</h2>
            <p className="opacity-90 text-sm mb-4">连接全球创新，驱动技术转化</p>
            <button className="bg-white text-orange-600 px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform">
              立即发布专利 <ChevronRight size={16} />
            </button>
          </div>
          <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
        </div>
      </div>

      {/* 核心功能入口 */}
      <div className="grid grid-cols-4 gap-4 px-4 py-4 text-center">
        {[
          { icon: <Moon className="text-orange-500" />, label: '沉睡专利' },
          { icon: <Trophy className="text-orange-500" />, label: '发明人榜' },
          { icon: <Map className="text-orange-500" />, label: '专利地图' },
          { icon: <Building2 className="text-orange-500" />, label: '机构展示' },
        ].map((item, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center shadow-sm">
              {item.icon}
            </div>
            <span className="text-xs font-bold text-gray-700">{item.label}</span>
          </div>
        ))}
      </div>

      {/* 成功案例指标 */}
      <div className="mx-4 my-2 bg-gray-900 rounded-2xl p-4 flex justify-around text-white border-t-2 border-orange-500 shadow-lg">
        <div className="text-center">
          <div className="text-orange-400 font-bold text-lg">5.2亿+</div>
          <div className="text-[10px] opacity-60">累计成交额</div>
        </div>
        <div className="w-[1px] bg-gray-700"></div>
        <div className="text-center">
          <div className="text-orange-400 font-bold text-lg">12,400+</div>
          <div className="text-[10px] opacity-60">入驻企业</div>
        </div>
        <div className="w-[1px] bg-gray-700"></div>
        <div className="text-center">
          <div className="text-orange-400 font-bold text-lg">98.2%</div>
          <div className="text-[10px] opacity-60">维权成功率</div>
        </div>
      </div>

      {/* 热门专利列表 */}
      <div className="px-4 mt-6">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            热门交易推荐 <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-bold">HOT</span>
          </h3>
          <span className="text-xs text-orange-600 font-medium">查看更多</span>
        </div>
        
        <div className="space-y-4">
          {patents.map(patent => (
            <div key={patent.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">{patent.industry}</span>
                <Star size={16} className="text-gray-300" />
              </div>
              <h4 className="font-bold text-gray-800 mb-2 line-clamp-1">{patent.title}</h4>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">{patent.type}</span>
                <span className="text-xs text-green-600 border border-green-200 px-2 py-0.5 rounded-full font-medium">已核验</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-50 pt-3">
                <div className="text-orange-600 font-bold text-lg">{patent.price}</div>
                <button className="bg-gray-900 text-white text-xs px-4 py-2 rounded-lg font-medium active:bg-orange-600 transition-colors">
                  查看详情
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* 渲染当前页面 */}
      {activeTab === 'home' && renderHome()}
      {activeTab === 'market' && <div className="p-8 text-center text-gray-500 font-bold text-orange-600">专利超市建设中...</div>}
      {activeTab === 'user' && (
        <div className="p-8 text-center text-gray-500">个人中心模块正在加载...</div>
      )}

      {/* 底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-md border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-orange-600' : 'text-gray-400'}`}
        >
          <Home size={22} />
          <span className="text-[10px] font-bold">首页</span>
        </button>
        <button 
          onClick={() => setActiveTab('market')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'market' ? 'text-orange-600' : 'text-gray-400'}`}
        >
          <Layers size={22} />
          <span className="text-[10px] font-bold">超市</span>
        </button>
        
        {/* 中心发布按钮 */}
        <div className="relative -mt-12">
          <div className="bg-gradient-to-t from-orange-600 to-yellow-500 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-orange-200 border-4 border-white active:scale-90 transition-transform cursor-pointer">
            <TrendingUp size={24} className="text-white" />
          </div>
        </div>

        <button 
          onClick={() => setActiveTab('trade')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'trade' ? 'text-orange-600' : 'text-gray-400'}`}
        >
          <Handshake size={22} />
          <span className="text-[10px] font-bold">交易</span>
        </button>
        <button 
          onClick={() => setActiveTab('user')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'user' ? 'text-orange-600' : 'text-gray-400'}`}
        >
          <User size={22} />
          <span className="text-[10px] font-bold">我的</span>
        </button>
      </div>
    </div>
  );
};

export default App;
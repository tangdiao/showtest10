/*
* 1.定义长宽、尺度、格式化数字、颜色尺度、弧生成器 开始-------------
* */
// 1.1 定义布局的大小
const width = window.innerWidth,
    height = window.innerHeight,
    maxRadius = Math.min(width, height) / 2 - 5;

// 1.2 格式化数字为00,000形式
const formatNumber = d3.format(',d');
const formatNumber2 = d3.format(',.2f')

// 1.3 定义画圆弧的比例尺、圆弧半径的比例尺，在补间函数处调用
const x = d3.scaleLinear()
    .range([0, 2 * Math.PI])
    .clamp(true);

const y = d3.scaleSqrt().range([maxRadius * 0.1, maxRadius]);

// 1.4 定义省份/城市显示的颜色
const light = [
    '#f08c83',
    '#e67164',
    '#da5545',
    '#cb3625',
    '#bb0000'
]

const palettes = [light];
const lightGreenFirstPalette = palettes
    .map(d => d.reverse())
    .reduce((a, b) => a.concat(b));

const color = d3.scaleOrdinal(lightGreenFirstPalette);

// 1.5 定义左侧城市排名的颜色显示
const colorSort = d3.scaleLinear()
    .domain([0,20])
    .range([
        "#fc3103",
        "#ebfc03",
        "#dbfc03",
        "#cafc03"
        ]);

// 1.6 定义每天的数据变化对应的颜色比例尺
var threshold = d3.scaleThreshold()//阈值比例尺
// .domain([0，max]) //这里咱们放在后面根据是否为武汉再定义数据的定义域
    .range(["#8cfc03",
        "#a9fc03",
        "#bafc03",
        "#cafc03",
        "#dbfc03",
        "#ebfc03",
        "#fcf003",
        "#fcd703",
        "#fcc203",
        "#fcad03",
        "#fc8803",
        "#fc7303",
        "#fc4a03",
        "#fc3103",
        "#fc0703"]);

// 1.7 定义用于格式化数据的d3方法：为了后面把层次数据递归的生成旭日图或饼状图
const partition = d3.partition();

// 1.8 定义一个弧生成器，用于画一块块的环
        /* 其中：
            x0:圆环开始角度
            x1:圆环结束角度
            y0:圆环内半径
            y1:圆环外半径
         */
const arc = d3
    .arc()
    .startAngle(d => x(d.x0))
    .endAngle(d => x(d.x1))
    .innerRadius(d => Math.max(0, y(d.y0)))
    .outerRadius(d => Math.max(0, y(d.y1)))
    .cornerRadius(function(d) { return 5;});

// 1.9 用于所有的对其方式
const middleArcLine = d => {
    const halfPi = Math.PI / 2;
    const angles = [x(d.x0) - halfPi, x(d.x1) - halfPi];
    const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);

    const middleAngle = (angles[1] + angles[0]) / 2;
    const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // 下象限按逆时针写入文本
    if (invertDirection) {
        angles.reverse();
    }

    const path = d3.path();
    path.arc(0, 0, r, angles[0], angles[1], invertDirection);
    return path.toString();
};

/*
* 2.定义一个画布和一个g元素：用于显示圆图主要区域
* */
const svg = d3
    .select('body')
    .append('svg')
    .style('width', '100vw')
    .style('height', '100vh')
    .attr('viewBox', `${-width / 2} ${-height / 2} ${width+10} ${height+10}`)
    .attr('transform','scale(0.95)')

const g= svg.append('g').attr("class", "main")

/*
* 3.根据传入的每一块的数据，返回对应的名称
*   主要是为了生成的json文件中国家的孩子、省份的孩子、城市的孩子的键不一致的情形。
* */
function showName(d) {
    return d.data.time?d.data.time:d.data.city_name?d.data.city_name
        :d.data.Province?d.data.Province:d.data.Country;
}

/*
* 4.在主方法中调用的函数：
* updateRoot：用于根据每一块环的点击事件，而确定生成树的根节点。而做的更新根节点的工作。返回一个对应根节点的JSON。
* textFits: 用于每一块slice上面的文字显示的生成器，返回true/false。
*
* */
    function updateRoot(root,cityName="武汉"){
        if(cityName == "中国")
            return root;
        var value = {};
        root.children.forEach(function (d,i) {
            d.children.forEach(function (d,j) {
                if(d.city_name === cityName){
                    value = root.children[i].children[j]
                }
            })
        });

        return value;
    }
    const textFits = d => {
        const CHAR_SPACE = 10;
        const deltaAngle = x(d.x1) - x(d.x0);
        const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);
        const perimeter = r * deltaAngle;

      return d.data.time?d.data.time.length * CHAR_SPACE < perimeter
          :d.data.city_name? d.data.city_name.length * CHAR_SPACE < perimeter:
              d.data.Province?d.data.Province.length * CHAR_SPACE < perimeter:
                  d.data.Country?d.data.Country.length * CHAR_SPACE < perimeter:false;
    };

/*
* 5.focusOn:用于每一块环的点击事件
* */
function focusOn(d) {

    // 如果未指定数据点，则重置为顶级，但是d为空，就会报错
    // 5.1 从d中抽取出x0,x1,y0用于定义每一块的位置
        const transition = svg
            .transition()
            .duration(500)
            .tween('scale', () => {
                const xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                    yd = d3.interpolate(y.domain(), [d.y0, 1]);
                return t => {
                    x.domain(xd(t));
                    y.domain(yd(t));
                };
            }); //补间函数根据每一块环的位置(x,y)绘制

    // 5.2 对这些位置调用弧度生成器进行绘制
        transition.selectAll('path.main-arc').attrTween('d', d => () => arc(d));

        // 5.3 绘制中间弧度的线，用于文字的逆时针显示
        transition
            .selectAll('path.hidden-arc')
            .attrTween('d', d => () => middleArcLine(d));

        // 5.4 通过递归，把环一块一块的重新绘制。
        moveStackToFront(d);
        //移动到前面显示的方法
        function moveStackToFront(elD) {
            // console.log(elD)  //elD就是包含从点击的那一块开始下的所有数据
            g.selectAll('.slice')
                .filter(d => d === elD)
                .each(function (d) {
                    this.parentNode.appendChild(this);
                    if (d.parent) {
                        moveStackToFront(d.parent); //递归
                    }
                });
        }
    }


/*
* 6.mainContent : 中间主体部分的渲染
* */
function mainContent(cityName = "中国") {
    d3.json(
        'flare.json',
        (error, root) => {
            if (error) throw error;

            // 6.1 移除现有的g.main，重新创建以在后面进行绘制
            svg.select('g.main').remove()
            const g = svg.append('g').attr("class", "main");

            // 6.2 从分层数据构造一个根节点，方便下面布局函数调用。并按照最后的add_size进行一个统计
            root = updateRoot(root,cityName)
            root = d3.hierarchy(root);
            root.sum(d => d.add_size);
            // root.sort((a,b)=> b.value - a.value)

            // 6.3 将数据进行绑定到一个个的slice上
            const slice = g.selectAll('g.slice').data(partition(root).descendants().filter(d => d.value>2
            ));
            slice.exit().remove();

            // 6.4 为每一块环绑定一个点击事件，用于进行变换
            const newSlice = slice
                .enter()
                .append('g')
                .attr('class', 'slice')
                .on('mouseover',d => changeContent2(d))
                .on('click', d => {
                    d3.event.stopPropagation();//阻止点击事件的传播
                    focusOn(d); //每一块都执行这个事件
                });

            function changeContent2(d){
                if(d.children){
                    var percent = formatNumber2(d.value/root.value * 100)+"%";
                    line1.datum(d).text(d => "3月15日(2020)");
                    line2.datum(d).text(d => d.data.Province? '当前省份: ' + d.data.Province:'当前国家: '+d.data.Country);
                    line3.datum(d).text(d => d.data.city_name?'当前城市:' + d.data.city_name:'');
                    line4.datum(d).text(d => '累计确诊人数: ' + formatNumber(d.value));
                    line5.datum(d).text(d => '全国占比: ' + percent);
                    removeLine();
                }
            }
            function removeLine(){
                line1.exit().remove();
                line2.exit().remove();
                line3.exit().remove();
                line4.exit().remove();
                line5.exit().remove();
            }
            //---------update---------

            // 6.5 当鼠标移动到每一块环上时，就显示这个文字
            newSlice.append('title')
                .text(d => showName(d) + '\n' + "确诊病例: " + formatNumber(d.value) + '\n');

           // 6.6 为每一块环的数据大小填充相应的颜色，并进行绘制环
            var colorfill = newSlice
                .append('path')
                .style("opacity", 1)
                .attr('class', 'main-arc')
                .attr('id', d => "ss" + showName(d) + d.value)
                .style("fill", d => city_color(d))
                .style('opacity',0.8)
                .attr('d', arc);

            function city_color(d) {
                return d.children ? (d.value<1000?"#A0B700":d.value<2000?
                    '#f08c83':d.value<4000?'#e67164':d.value<60000?'#da5545':d.value<80000?'#cb3625':'#bb0000')
                    : day_color(d);
            }

            function day_color(d) {
                if (d.parent.data.city_name === "武汉") {
                    threshold.domain([50, 100, 150, 200, 300, 400, 600, 800, 1000, 1250, 1500, 2000, 4000, 10000])
                    return threshold(d.value)
                }
                threshold.domain([10, 20, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 350, 400])

                return threshold(d.value)
            }

            // 6.7 绘制每一块环上面的文字的曲线，文字内容和轮廓，以及对隐藏的模块的设计
            newSlice
                .append('path')
                .attr('class', 'hidden-arc')
                .attr('id', (_, i) => `hiddenArc${i}`)
                .attr('d', middleArcLine);

            const text = newSlice
                .append('text')
                .attr('display', d => (textFits(d) ? null : 'none'));

            // 6.8 为文字增加白色轮廓
            text
                .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', (_, i) => `#hiddenArc${i}`)
                .text(d => showName(d))
                .style('fill', 'none')
                .style('stroke', '#E5E2E0')
                .style('stroke-width', 12)
                .style('stroke-linejoin', 'round');

            text
                .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', (_, i) => `#hiddenArc${i}`)
                .text(d => showName(d));
        });
}

/*
* 7.界面左侧文字的排序、点击事件实现。界面右侧的显示数据
*
* */
function showLeftContent() {
    d3.json('flare.json', (error, root) => {

        root = d3.hierarchy(root);
        root.sum(d => d.add_size);
        // 7.1 提取并构造原数据集中的相应所有城市数据
        var maps = [];
        root.children.forEach(function (d) {
            var amap = [];
            d.children.forEach(function (d) {
                // console.log(d)
                amap.push({
                    "city_name": d.data.city_name,
                    "value": d.value,
                    "percent": formatNumber2(d.value / d.parent.parent.value * 100) + "%",
                    "province": d.data.Province,
                    "end_time":d.children[d.children.length-1].data.time
                })
            });
            maps = d3.merge([maps, amap])
        });
        city_length = maps.length; // 城市的数量，用于显示

        // 7.2 按照累计人数从大到小排序
        var asc = function (x, y) {
            return (x["value"] < y["value"]) ? 1 : -1
        };
        maps = maps.sort(asc); // 升序排序
        maps = maps.slice(0, 17); // 只取前面的25个
        // console.log(maps)

        // 7.2 显示右侧的数据
        const gRightStartX = 20;
        const gRightStartY = 40;
        const gRightpadding = 24;
        const gRightSource = svg.append("g")
            .attr("class", "right_top")
            .style("width", "50vw")
            .style("height", "50vh")
            .attr("transform", "translate(" + (3 * width / 10) + "," + (-3.8 * height / 10) + ")");
        gRight = gRightSource.append('g')

        line1 = gRight.append('text').attr('id', "top-text-show")
            .attr('x', gRightStartX).attr('y', gRightStartY)
            .attr('font-size', 8.12)
            .attr('opacity', 1)
            .style('fill', "#646464")

        line2 = gRight.append('text').attr('id', "top-text-show")
            .attr('x', gRightStartX).attr('y', gRightStartY+gRightpadding)
            .attr('font-size', 8.12)
            .attr('opacity', 1)
            .style('fill', "black")

        line3 = gRight.append('text').attr('id', "top-text-show")
            .attr('x', gRightStartX).attr('y', gRightStartY+2*gRightpadding)
            .attr('font-size', 8.12)
            .attr('opacity', 1)
            .style('fill', "black")

        line4 = gRight.append('text').attr('id', "top-text-show")
            .attr('x', gRightStartX).attr('y', gRightStartY+3*gRightpadding)
            .attr('font-size', 8.12)
            .attr('opacity', 1)
            .style('fill', "black")

        line5 = gRight.append('text').attr('id', "top-text-show")
            .attr('x', gRightStartX).attr('y', gRightStartY+4*gRightpadding)
            .attr('font-size', 8.12)
            .attr('opacity', 1)
            .style('fill', "black")

        changeContentAll();

        // 7.3 显示左侧排序数据
        const gLeftStartX = 20;
        const gLeftStartY = 30;
        const gLeftPadding = 30;
        const gLeft = svg.append("g")
            .attr("class", "left")
            .style("width", "50vw")
            .style("height", "50vh")
            .attr("transform", "translate(" + (-5 * width / 10) + "," + (-5 * height / 10) + ")")

        gLeft.append('text').attr('id', "top-text")
            .attr('x', gLeftStartX).attr('y', gLeftStartY)
            .text('COVID-19 in China')

        gLeft.append('text').attr('class', 'source_text')
            .attr('x', gLeftStartX+3*gLeftPadding).attr('y', 2.4*gLeftStartY).text('Data Source: National Health Commission')
            .on('click', function () {
                window.location.href = "http://www.nhc.gov.cn/"
            });

        //------国内情况
        gLeft.append('text')
            .style("text-anchor", "start")
            .style("font-size", 12)
            .style("writing-mode", "")
            .style("stroke", "none")
            .style("fill", "white")
            .attr('x', gLeftStartX+0.7*gLeftPadding)
            .attr('y', 2*gLeftStartY+gLeftPadding)
            .attr('dy',"1em")
            .text('国内情况')
            .on("click", mainContent)
            .on('mouseover',changeContentAll)


        var widthScale = d3.scalePow()
            .exponent(0.3)
            .domain([0, 1000])
            .range([0, 50]);

        // 全国所有的数据绘制条形图和显示比例
        gLeft.datum(root).append('rect')
            .attr('x', gLeftStartX+3*gLeftPadding)
            .attr('y', 2*gLeftStartY+gLeftPadding)
            .attr('width', d => parseInt(widthScale(d.value)))
            // .attr('width',20)
            .attr('height', 15)
            .style('ry', 8)
            .style('fill', colorSort(1))
            .style('opacity',0.8)
            .on("click", () => mainContent())
            .on('mouseover',() => {changeContentAll()})
            .append('title')
            .text(d => showInfo(d)) //鼠标悬停在上面时，显示的文字
            // .style('fill','red')
            .attr('class', 'text-font');

        gLeft.datum(root).append('text')
            .attr('x', gLeftStartX+3.1*gLeftPadding)
            .attr('y', 2*gLeftStartY+gLeftPadding)
            .attr('dy',"1em")
            .style("text-anchor", "start")
            .style("font-size", 10)	//文本字体大小
            .style("writing-mode", "")	//文本书写格式
            .style("stroke", "none")	//文本描边色
            .style("fill", "white")	//文本填充色
            .text("100%")
            .on('click', () => mainContent())
            .append('title')
            .text(d => showInfo(d))
            .attr('class', 'font-face');

        function showInfo(d) {
            show_time = d.children[0].children[0].children;

            return "国家：" + d.data.Country + "\n" + "统计省份：" + d.children.length + "\n" + "统计城市：" + city_length + "\n"
                + "累计确诊：" + formatNumber(d.value) + "（人）\n"
                + "重点城市：" + maps[0].city_name + '、' + maps[1].city_name + '、' + maps[2].city_name + '\n' + maps[3].city_name
                + '、' + maps[4].city_name + '、' + maps[5].city_name + "\n\n"
                + "数据来源：中国卫健委" + '\n'
                + "统计时间段：" + show_time[0].data.time + "--" + show_time[show_time.length - 1].data.time
        }

        // 一个图标格式，目前还没有开发相应的事件
        gLeft
            .selectAll('rect.control').data(['comp1', 'comp2']).enter()
            .append('rect')
            .attr('x', function (d, i) {
                return 1.2*gLeftStartX+0.7*(i+1)*gLeftPadding;
            }).attr('y', 2*gLeftStartY)
            .attr('width', 15).attr('height', 15)
            .attr('ry', 2)
            .style('fill', d => d === "comp1" ? "red" : "black");

        var sortCity = gLeft.append('g').attr('class', 'types');

        sortCity.selectAll('sort_rect').data(maps).enter().append('rect')
            .attr('x', gLeftStartX+3*gLeftPadding)
            .attr('y', (d, i) => 2*gLeftStartY + (i+2) * gLeftPadding)
            .attr('width', (d, i) => parseInt(widthScale(d.value)))
            // .attr('width',20)
            .attr('height', 15)
            .style('ry', 8)
            .style('fill', (d, i) => colorSort(i))
            .style('opacity',0.8)
            // .on("mouseover", d => changeColor(d))
            .on('click', d => mainContent(d.city_name))
            .on('mouseover',d => changeContent(d))
            .append('title')
            .text((d, i) => "排名：" + (i + 1) + "\n" + "省份：" + d.province + "\n" + "城市：" + d.city_name + "\n" + "累计确诊：" + d.value + '\n' + "全国比例：" + d.percent) //鼠标悬停在上面时，显示的文字
            .attr('class', 'text-font');

        function changeContent(d){

            line1.datum(d).text(d => d.end_time + "(2020)");
            line2.datum(d).text(d => '当前省份: ' + d.province);
            line3.datum(d).text(d => '当前城市: ' + d.city_name);
            line4.datum(d).text(d => '累计确诊人数: ' + formatNumber(d.value));
            line5.datum(d).text(d => '全国占比：' + d.percent);

            removeLine();

        }
        function changeContentAll(){

            line1.datum(root).text(d => show_time(d) + "(2020)");
            line2.datum(root).text(d => '确诊省份: ' + d.children.length);
            line3.datum(root).text(d => '确诊城市: ' + city_length);
            line4.datum(root).text(d => '累计确诊病例: ' + d.value);
            line5.text('重点城市：' + maps[0].city_name + '、' + maps[1].city_name + '、' + maps[2].city_name);

            function show_time(d) {
                show_time = d.children[0].children[0].children;
                return show_time[show_time.length - 1].data.time;
            }

            removeLine();
        }
        function removeLine(){
            line1.exit().remove();
            line2.exit().remove();
            line3.exit().remove();
            line4.exit().remove();
            line5.exit().remove();
        }


        sortCity.selectAll('sort_percent').data(maps).enter().append('text')
            .attr('x', gLeftStartX+3.1*gLeftPadding)
            .attr('y', (d, i) => 2.4*gLeftStartY + (i+2) * gLeftPadding)
            .style("text-anchor", "start")
            .style("font-size", 10)
            .style("writing-mode", "")
            .style("stroke", "none")
            .style("fill", "white")
            .text(d => d.percent)
            .on('click', d => mainContent(d.city_name))
            .append('title')
            .text((d, i) => "排名：" + (i + 1) + "\n" + "省份：" + d.province + "\n" + "城市：" + d.city_name + "\n" + "累计确诊：" + d.value + '\n' + "全国比例：" + d.percent) //鼠标悬停在上面时，显示的文字
            .attr('class', 'text-font');

        //--------文字---------
        sortCity.selectAll('sort_text').data(maps).enter().append('text')
        // .attr("transform","translate("+(-5*width/10)+","+(-2*height/5)+")")
            .attr('x', gLeftStartX+0.6*gLeftPadding)
            .attr('y', (d, i) => 2.4*gLeftStartY + (i+2) * gLeftPadding)
            .style("text-anchor", "start")	//文本对齐方式
            .style("font-size", 10)	//文本字体大小
            .style("writing-mode", "")	//文本书写格式
            .style("stroke", "none")	//文本描边色
            .style("fill", "white")	//文本填充色
            .text(function (d, i) {
                return (i + 1) + " " + d.province + "-" + d.city_name;
            })
            .on('click', d => mainContent(d.city_name))
            .on('mouseover',d => changeContent(d));
    });
}

/*
*  8.图例部分
* */
function loadLegend(){
    const g_right = svg.append("g")
        .attr("class", "right")
        .style("width", "50vw")
        .style("height", "50vh")
        .attr("transform", "translate(" + (3.5 * width / 10) + "," + (-2 * height / 10) + ")")

    g_right.append('text').attr('class',"font-face").attr("x",-90).attr("y",365)
        .append('tspan').attr("x",-60).attr('dy','1em').text('当前确诊数据来自中国卫健委官方公布的数据,每日')
        .append('tspan').attr("x",-82).attr('dy','1.2em').text('新增数据根据各地上报收集整理。更新时间存在部分不')
        .append('tspan').attr("x",-82).attr('dy','1em').text('一致/延迟的问题。如有相关建议，欢迎联系指出。')
    var data = d3.range(100,1500,100)
    var color = d3.scaleLinear()
        .domain(data)
        .range(threshold.range());

    var Scale = d3.scaleLinear()
        // .exponent(2)
        .domain(data)
        .range([0,10])

    g_right.selectAll('.notwuhan').data(data).enter().append('rect')
        .attr("width",40)
        .attr("height",20)
        .attr("x",0)
        .attr("y",d => 200+Scale(d))
        .style('fill',d => color(d))
        .style('opacity',0.8)

    g_right.append('text').attr("x",50).attr("y",208).text('0').attr('class',"font-face")
    g_right.append('text').attr("x",50).attr("y",348).text('13,000+人确诊（武汉）').attr('class',"font-face")
    // g_right.append('text').attr("x",-50).attr("y",208).text('0').attr('class',"font-face")
    g_right.append('text').attr("x",-90).attr("y",348).text('（非武汉）400+').attr('class',"font-face")
    g_right.append('text').attr("x",-60).attr("y",278).text('100 to 125').attr('class',"font-face")
    g_right.append('text').attr("x",50).attr("y",278).text('600 to 800').attr('class',"font-face")
}

showLeftContent();
loadLegend();
mainContent();





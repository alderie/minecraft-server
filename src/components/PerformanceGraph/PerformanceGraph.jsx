

import React, { Component } from 'react';
import p5 from 'p5';

import './PerformanceGraph.scss';

class PerformanceGraph extends Component {
    constructor(props) {
        super(props);

        this.canvas = null; 
        this.canvasHeight = 200;
        this.canvasWidth = document.body.clientWidth;
    }

    sketch(p) {


        let drawLine = (x1,y1, x2, y2)=>{
            p.line(x1,this.canvasHeight-y1, x2, this.canvasHeight-y2);
        }

        let drawGraph = (points, scaleFactor) => {

            p.stroke(255, 82, 113);
            p.strokeWeight(3);

            let x = this.canvasWidth;
            
            for(let i = points.length-1; i > 0; i--) {
                drawLine(x-5, Math.min(points[i-1][1].cpu, 100) * scaleFactor + 5, x, Math.min(points[i][1].cpu, 100) * scaleFactor + 5)
                x-=5;
            }
        } 

        let drawLabel = (cpuUse, ramUse)=> {

            p.textSize(18);
            p.noStroke()
            p.textFont("Roboto Mono");

            p.fill(255, 82, 113)

            p.textAlign(p.RIGHT);
            p.text(`${Math.floor(cpuUse)}% CPU`, this.canvasWidth - 40, 30);
            p.textSize(12);
            p.text(`${Math.floor(ramUse)}MB RAM`, this.canvasWidth - 40, 50);
        }

        p.setup = ()=>{
            p.createCanvas(this.canvasWidth, this.canvasHeight);
        }

        p.draw = ()=>{
            p.background(255)

            if(this.props.data.length > 0) {
                
                drawGraph(this.props.data, 1.1);

                p.strokeWeight(1);

                let pointIdx = this.canvasWidth/5 - Math.floor(p.mouseX/5);

                drawLine(Math.floor(p.mouseX/5) * 5, 0, Math.floor(p.mouseX/5) * 5, this.canvasHeight);

                let targetPoint = this.props.data[this.props.data.length - Math.floor(pointIdx)];


                if(targetPoint) {
                    //CPU usage (includes extra cores), memory in bytes converted to MB
                    drawLabel(Math.min(targetPoint[1].cpu, 100), Math.floor(targetPoint[1].memory * 0.000001));
                } else {

                    let targetPoint = this.props.data[this.props.data.length-1];

                    drawLabel(Math.min(targetPoint[1].cpu, 100), Math.floor(targetPoint[1].memory * 0.000001));
                }

            } else {

                p.textSize(18);
                p.noStroke()
                p.textFont("Roboto Mono");
                p.textAlign(p.CENTER);

                p.text(`No server running!`, this.canvasWidth/2, this.canvasHeight/2);

            }

            //p.noLoop();
        }
    }

    componentDidMount() {
        this.canvas = new p5(this.sketch.bind(this), 'canvas')
    }

    render() {
        return (
            <div className='performance' id='canvas'>
            </div>
        )
    }
}

export default PerformanceGraph;
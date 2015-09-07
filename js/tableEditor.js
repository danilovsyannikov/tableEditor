/*
 * TableEditor on HTML and jQuery
 * version 0.9
 */
(function ($)
{	
	var _EXCLUDE_PROPS      = { '_TD': true, 'coords': true, 'colspan': true, 'rowspan': true, 'getData': true, 'setData': true, 'toolSel': true };
	var _EXCLUDE_PROPS2     = { '_TD': true, 'coords': true, 'getData': true, 'aZone': true, 'maxindex': true, 'toolSel': true, 'toolSelRow': true, 'toolSelCol': true };
	var _ALLOW_CONTEXT_MENU		= true;
	var _COUNT_OF_TOOLS_ROWS	= 2;
	var _COUNT_OF_TOOLS_COLS	= 1;

	$.TableEditor			= function($root, options)
	{
		if($root[0].LayoutEditorIsInit)
			return $root[0].LayoutEditorIsInit;
		$root[0].LayoutEditorIsInit = this;

		//настройки
		var _opt				= {
			initDrag			: false,
			startPos			: {},
			disableEdit			: false,
			data				: { maxindex:1, matrix:[['0']],	cells:{'0':{content:'Cell1'}}, aZone:{}},
			t					: $root,
			oCi					: null,
			onEdit				: null,
			clipboard			: { //буфер обмена
				cellSource		: null,
				cutAfterPaste	: false
			},
			reserveCopy			: null,
			ui					: {
				spanL			: $('<span class="addArrowL icon-t addCol" title="Добавить столбец"/>'),
				spanR			: $('<span class="addArrowR icon-t addCol" title="Добавить столбец"/>'),
				spanT			: $('<span class="addArrowT icon-t addRow" title="Добавить строку"/>'),
				spanB			: $('<span class="addArrowB icon-t addRow" title="Добавить строку"/>'),
				spanDC			: $('<span class="delCrossT icon-t delCol" title="Удалить столбец"/>'),
				spanDR			: $('<span class="delCrossL icon-t delRow" title="Удалить строку"/>'),
				spanMERGE		: $('<span class="tool_merge icon-t merge" title="Объединить ячейки"/>'),
				spanUNMERGE		: $('<span class="tool_unmerge icon-t unmerge" title="Разделить объединенные ячейки"/>'),
				spanCELLOPT		: $('<span class="icon-t cellOptions" title="Свойство ячейки"/>'),				
				tdSpacer		: $('<TD class="spacer arrows toolbar"/>&nbsp;</TD>'),
				tdHorTabPrev	: $('<TD class="horTabPrev arrows toolbar"/>&nbsp;</TD>'),
				tdHorTools		: $('<TD class="arrows toolbar"/>'),			
				tdHorTabAfter	: $('<TD class="horTabAfter arrows toolbar"/>&nbsp;</TD>'),
				tdVerTabPrev	: $('<TD class="verTabPrev arrows toolbar"/>'),
				tdVerTools		: $('<TD class="arrows toolbar verTab"/>'),
				tdVerTabAfter	: $('<TD class="verTabAfter arrows toolbar"/>'),
				colIndexes		: null,
				rowIndexes		: null,
				contextCircleMenu		: null
			}
		};
		if(options.data == 'AUTO')
		{	//строим матрицу по DOM
			options.data =  _createMatrix($root);
			$root.addClass('layoutTable');
			_opt.reserveCopy = $root[0].outerHTML; //сохраняем исходную таблицу на случай отмены редактирования
		}

		$.extend(_opt.data, options.data);
		_opt.onEdit				= options.onEdit || null;
		_opt.ui.colIndexes		= new _colIndexTDs(_opt);
		_opt.ui.rowIndexes		= new _rowIndexTDs(_opt);
		_opt.ui.contextCircleMenu		= new contextCircleMenu(_opt);

		for(var c in _opt.data.cells)
		{
			_opt.data.cells[c]		= _initCell(_opt.data.cells[c]);
		}
		
		$root					.on('click', '.addArrowL',     function(e){ _addCol(_opt, 'l');	})
								.on('click', '.addArrowR',     function(e){ _addCol(_opt, 'r');	})
								.on('click', '.addArrowT',     function(e){ _addRow(_opt, 't');	})
								.on('click', '.addArrowB',     function(e){ _addRow(_opt, 'b');	})
								.on('click', '.delCrossT',     function(e){ _delCol(_opt);		})
								.on('click', '.delCrossL',     function(e){ _delRow(_opt);		})
								.on('click', '.cellOptions',   function(e){ _cb(_opt);			})
								.on('click', '.tool_merge',	   function(e){ _merge(_opt); 		})
								.on('click', '.tool_unmerge',  function(e){ _unMerge(_opt);		})
								.on('click', 'TD.tool_row',	   function(e){ _selectCol(e, _opt);})
								.on('click', 'TD.tool_col',	   function(e){ _selectRow(e, _opt);})
								.on('click', '.closeContMenu', function(e){ _opt.ui.contextCircleMenu.hide();})
								.on('click', '.cellCut',	   function(e){ _copy(_opt, true); })
								.on('click', '.cellCopy',	   function(e){ _copy(_opt, false); })
								.on('click', '.cellPaste',	   function(e){ _paste(_opt); })
								.on('mousedown', 'TD.item',	   function(e){ _mouseDown(e, _opt);})
								.on('contextmenu','TD.item',   function(e){ _openContextMenu(e, _opt);})
								.on('mousemove', 'TD.item',	   function(e){ _mouseMove(e, _opt);})
								.on('mouseup',				   function(e){ _mouseUp(e, _opt);	})
								.on('click',	'TD.item',	   function(e){ e.preventDefault(); });								

		// render
		_renderAll(_opt);
				
		this.getDataJson		= function(full){ return _getDataJson(_opt, full);};
		this.disableEdit		= function(){ _opt.disableEdit = true; };
		this.enableEdit			= function(){ _opt.disableEdit = false;};
		this.getHTML			= function(){ return _getHTML(_opt); };
		this.destroy			= function(getBackup){ return _destroy(_opt, getBackup); };

		this.toggleBorder		= function(borderVal){ return _toggleBorder(_opt, borderVal); };
	}

	//построить и вернуть матрицу по DOM
	function _createMatrix($root)
	{
		var t					= $root[0], //found table!!! //TODO
			index				= 0,
			deltaI				= _COUNT_OF_TOOLS_ROWS,
			deltaJ				= _COUNT_OF_TOOLS_COLS,
			maxI				= 0,
			row,
			cell,
			realI,
			realJ,
			obj					= {};
			obj.matrix			= [];
			obj.cells			= {};
			
		//определям maxI
		row = t.rows[0];
		for(var j=0;cell = row.cells[j];j++)
		{
			maxI += cell.colSpan;
		}		

		realI = 0;
		for (var i = 0, row; row = t.rows[i]; i++) {
			realJ = 0;
			for (var j = 0, cell; cell = row.cells[j]; j++) {
				_createCellDataIndex(obj, cell, index);			
				
				// смотрим на ячейки выше уровнем (c rowSpan > 1)
				if(realI>0)
				{			
					for( var prevRowCellData = obj.cells[ obj.matrix[realI - 1][realJ] ]; 
							prevRowCellData && prevRowCellData.rowspan > 1; 
							prevRowCellData = obj.cells[ obj.matrix[realI - 1][realJ] ] )
					{
						if(realI <= (prevRowCellData.startFromRow + prevRowCellData.rowspan - 1))
							realJ = prevRowCellData.startFromCol + prevRowCellData.colspan;
						else
							break;
					}
				}

				// смотрим на ячейки слева (colSpan > 1)
				var prevColCellData;
				if(realJ > 0 
					&& (prevColCellData = obj.cells[ obj.matrix[realI][realJ - 1] ] )
					&& prevColCellData.colspan > 1)
						realJ = prevColCellData.startFromCol + prevColCellData.colspan; 

				obj.cells[index].startFromRow = realI;
				obj.cells[index].startFromCol = realJ;

				for(var z = realJ; z <= (realJ + cell.colSpan - 1); z++)
					for(var k = realI; k <= (realI + cell.rowSpan - 1); k++)	
					{
						if($.type( obj.matrix[k] ) != "array")
							obj.matrix[k] = [];
						obj.matrix[k][z] = index;
					}

				index++;
				realJ++;
			} 
			realI++;
		}
		return obj;
	}

	//возвращает чистый HTML таблицы
	function _getHTML(opt)
	{
		var tbl = document.createElement('table'),
			t	= opt.t[0],
			r, // new created row
			c, // t.rows[i].cells[j]
			nc;// new created cell

		tbl.className = "simpleTable";
		for(var i = 0; i < t.rows.length; i++)
		{
			if(i == 0 || r.cells.length > 0) //если первая строка или в прошлой строке были ячейки
				r = tbl.insertRow(-1);
			for(var j = 0; j < t.rows[i].cells.length; j++)
			{
				c = t.rows[i].cells[j];				
				if($(c).hasClass('item'))
				{
					nc = r.insertCell(-1);
					if(c.colSpan > 1)
						nc.colSpan = c.colSpan;
					if(c.rowSpan > 1)
						nc.rowSpan = c.rowSpan;
					nc.innerHTML = $(c).hasClass('pagepart_placeholder') ? '' : c.innerHTML;
				}
			}
		}		

		return tbl;
	}

	//уничтожаем редактор, оставляем таблицу
	function _destroy(opt, getBackup)
	{
		var resultHtml = _getHTML(opt);
		opt.t.off();
		opt.t[0].LayoutEditorIsInit = null;
		if(getBackup == true)
			opt.t.after(opt.reserveCopy);
		else
			opt.t.after(resultHtml);
		opt.t.remove();			
		return true;
	}

	function _createCellDataIndex(obj, cell, index)
	{

		obj.cells[index]		= {};
		if(cell.colSpan > 1)
			obj.cells[index].colspan = cell.colSpan;
		else
			obj.cells[index].colspan = 1;
		if(cell.rowSpan > 1)
			obj.cells[index].rowspan = cell.rowSpan;
		else
			obj.cells[index].rowspan = 1;
		if(cell.innerHTML)
		{
			obj.cells[index].content = cell.innerHTML;
			//чтобы корректно перенесся content
			obj.cells[index].Code	= 'HTML';
		}
		
	}

	//вернуть данные о разметке таблицы
	function _getDataJson(opt, full)
	{
		var data				= opt.data;
		var full				= full || false;
		if(full)
			return JSON.stringify(data, function(p,v){return p=='_TD' ? undefined : v});
		else
			return JSON.stringify(data, function(p,v){return _EXCLUDE_PROPS2[p]? undefined : v});		
	}

	// Добавление/удаление строки //
	function _addRow(opt, dir)
	{
		if(opt.disableEdit)
			return;

		var data				= opt.data,
			index, row, c, num, r, trow;
			

		if(dir==='t')
		{
			index				= data.toolSelRow || data.aZone.t || 0;
		}else
		{
			index				= (data.toolSelRow+1) || (data.aZone.b+1) || (data.matrix.length+1);
		}
		row						= new Array(data.matrix[0].length);		
		if(0 < index && index < data.matrix.length)
		{
			// Вставка в середину
			r					= index - 1;
			trow				= data.matrix[r];
			for(c = 0; c < trow.length; c++)
			{
				num = trow[c];
				var cell = data.cells[num];
				if(cell.coords.b >= index)
				{
					cell.rowspan++;
					row[c] = num;
					if(cell.colspan > 1)
					{
						for(var cend = cell.coords.r; c <= cend; c++)
						{
							row[c] = num;
						}
					}
				}
			}
		}
		for(c = 0; c < row.length; c++)
		{
			if(row[c] == null)
			{
				num					= _newNum(opt);
				row[c]				= num;
				data.cells[num]		= _newCell(num);
			}
		}
		data.matrix.splice(index, 0, row);
		_unselectCells(opt);
		_renderAll(opt)
	}

	function _delRow(opt)
	{
		if(opt.disableEdit)
			return;
		var data				= opt.data;
		var index				= data.toolSelRow || 0;
		var delNums				= {};			
		var err					= false;
		var s,e,i;
	
		if(!$.isEmptyObject(data.aZone))
		{
			s = data.aZone.t;
			e = data.aZone.b;
			if( data.matrix.length - (e - s + 1) < 1 ) 
				err = true;
		}else
		{
			s = index;
			e = index;			
			if(data.matrix.length <= 1)
				err = true;
		}		
		if(!err) //только если это не единственная оставшаяся строка
		{
			for(i=s;i<=e;i++)
			{
				for(var c = 0; c < data.matrix[0].length; c++)
				{
					var num = data.matrix[i][c];
					var cell = data.cells[num];

					if(cell.rowspan > 1)
					{
						cell.rowspan--;
						if(cell.colspan > 1)
						{
							c += cell.colspan - 1;
						}
						continue;
					}
				}
				data.matrix.splice(i, 1);				
			}
		}
		if(err)
		{
			alert('Необходимо оставить хотя бы одну строку.');
		} else
		{
			_unselectCells(opt);
			_renderAll(opt)
		}
	}

	// /Добавление/удаление строки //
	// Добавление/удаление столбца //

	function _addCol(opt, dir)
	{
		if(opt.disableEdit)
			return;

		var index;
		var data				= opt.data;
		if(dir==='l')
		{
			index = data.toolSelCol || data.aZone.l || 0;
		}else
		{
			index = (data.toolSelCol+1) || (data.aZone.r+1) || (data.matrix[0].length+1)
		}

		var col = new Array(data.matrix.length);
		if(0 < index && index < data.matrix[0].length)
		{
			// Вставка в середину
			var c = index - 1;
			for(var r = 0; r < data.matrix.length; r++)
			{
				var trow = data.matrix[r];
				var num = trow[c];
				var cell = data.cells[num]
				if(cell.coords.r >= index)
				{
					cell.colspan++;
					col[r] = num;
					if(cell.rowspan > 1)
					{
						for(var rend = cell.coords.b; r <= rend; r++)
						{
							col[r]	= num;
						}
					}
				}
			}
		}

		for(var c = 0; c < col.length; c++)
		{
			if(col[c] == null)
			{
				var num				= _newNum(opt);
				col[c]				= num;
				data.cells[num]		= _newCell(num);
			}
		}
		for(var r = 0; r < col.length; r++)
		{
			data.matrix[r].splice(index, 0, col[r]);
		}
		_unselectCells(opt);
		_renderAll(opt)
	}

	function _delCol(opt)
	{
		if(opt.disableEdit)
			return;

		var data				= opt.data;
		var index				= data.toolSelCol || 0;
		var delNums				= {};
		var r;
		var err					= false;
		var s,e,i;

		if(!$.isEmptyObject(data.aZone))
		{
			s = data.aZone.l;
			e = data.aZone.r;
		}else
		{
			s = index;
			e = index;			
		}

		if(s==0 && e == data.matrix[0].length-1)
			err = true;

		for(i=s;i<=e && !err;i++)
		{
			for(r = 0; r < data.matrix.length && !err; r++)
			{
				if(data.matrix[r].length > 1) //уже не так актуально, проверка выше
				{
					var num = data.matrix[r][i];
					var cell = data.cells[num];

					if(cell.colspan > 1)
					{
						cell.colspan--;
						if(cell.rowspan > 1)
						{
							for(var rend = cell.coords.b; r <= rend; r++)
							{
								data.matrix[r].splice(i, 1);
							}
							r--; //иначе счетчик перескакивает
							continue;
						}
					}

					data.matrix[r].splice(i, 1);
				}else
				{
					err		= true;
				}				
			}
		}

		if(err)
		{
			alert('Необходимо оставить хотя бы один столбец.');
		} else
		{
			_unselectCells(opt);
			_renderAll(opt)
		}
	}

	// /Добавление/удаление столбца //

	// Разъединение //

	function _unMerge(opt)
	{
		if(opt.disableEdit)
			return;

		var data				= opt.data;

		if($.isEmptyObject(data.aZone))
		{
			return;
		}

		for(var r = data.aZone.t; r <= data.aZone.b; r++)
		{
			for(var c = data.aZone.l; c <= data.aZone.r; c++)
			{
				var num = data.matrix[r][c];
				var cell = data.cells[num];
				var coords = cell.coords;

				if( coords.t != coords.b || coords.l != coords.r )
				{
					if(coords.t == r && coords.l == c)
					{
						cell.colspan = 1;
						cell.rowspan = 1;
					}else
					{
						num					= _newNum(opt);
						data.matrix[r][c]	= num;
						data.cells[num]		= _newCell(num);
					}
				}
			}
		}
		_unselectCells(opt);
		_renderAll(opt)
	}

	// /Разъединение //

	// Объединение //
	function _merge(opt)
	{
		if(opt.disableEdit)
			return;
		
		var data				= opt.data;
		var num					= data.matrix[data.aZone.t][data.aZone.l];
		for(var r = data.aZone.t; r <= data.aZone.b; r++)
		{
			for(var c = data.aZone.l; c <= data.aZone.r; c++)
			{
				data.matrix[r][c]	= num;
			}
		}
		var cell			= data.cells[num];
		cell.rowspan		= ( data.aZone.b - data.aZone.t + 1 );
		cell.colspan		= ( data.aZone.r - data.aZone.l + 1 );

		_unselectCells(opt);
		_renderAll(opt)
	}

	// /Объединение //

	//выполнение стороннего cb для выделенной ячейки (обычно - выставление свойств)
	function _cb( opt )
	{
		if(opt.disableEdit || !opt.onEdit)
			return;
		var data				= opt.data;
		var d					= data.aZone;
		var n					= data.matrix[ d.t ][ d.l ];
		var c					= data.cells[n];
		var cd					= c.getData();
		cd.update				= function()
		{
			c.setData(cd);
		};
		opt.ui.contextCircleMenu.hide();
		opt.onEdit(cd);
		
	}

	// копировать данные ячейки
	function _copy( opt, cutAfterPaste )
	{
		opt.clipboard.cutAfterPaste = cutAfterPaste; //режим копирования или вырезания

		// выделяем ячейку и ставим на нее указатель (заимствовано из function _cb())
		var data				= opt.data;
		var d					= data.aZone;
		var n					= data.matrix[ d.t ][ d.l ];
		var c					= data.cells[n];

		if(opt.clipboard.cellSource)
			opt.clipboard.cellSource._TD
				.removeClass('clipboardActiveCopy') //отменяем прошлое выделение
				.removeClass('clipboardActiveCut'); //

		c._TD.addClass( cutAfterPaste ? 'clipboardActiveCut' : 'clipboardActiveCopy');
		opt.clipboard.cellSource = c;
		
		opt.ui.contextCircleMenu.hide();
	}

	// вставить данные из другой ячейки
	function _paste( opt, verify )
	{
		var data				= opt.data,
			d					= data.aZone,
			n					= data.matrix[ d.t ][ d.l ],
			cTo					= data.cells[n],
			cFrom				= opt.clipboard.cellSource,
			cd;
	
		// вставляем данные в ячейку
		if(!cFrom)
			return;
		cd = cFrom.getData();
		// проверка на непустую ячейку
		cd1 = cTo.getData();
		//TODO:if question for overwrite data in cell
		_paste(opt, true)
		//
		cTo.setData(cd);

		if(opt.clipboard.cutAfterPaste)
		{
			cFrom.setData(null);
		}

		// чистим мусор
		opt.clipboard.cellSource = null;
		opt.clipboard.cutAfterPaste = false;
		cFrom._TD
			.removeClass('clipboardActiveCopy') //отменяем прошлое выделение
			.removeClass('clipboardActiveCut'); //

		opt.ui.contextCircleMenu.hide();
	}

	// Сервис //

	/*
	example:
	_visit(opt, function(r, c, num, cell){});
	*/
	function _visit(opt,f)
	{
		var visited				= {};
		var data				= opt.data;
		for(var r = 0; r < data.matrix.length; r++)
		{
			var row			= data.matrix[r];
			for(var c = 0; c < row.length; c++)
			{
				var num = row[c];
				if(!visited[num])
				{
					visited[num] = true;
					f(r, c, num, data.cells[num]);
				}
			}
		}
	}
	
	function _copyData(from, to)
	{
		for(var m in from)
		{
			if(_EXCLUDE_PROPS[m]!=true && from.hasOwnProperty(m))
				to[m]		= from[m];
		}

		return to;
	}

	function _newCell(content)
	{
		return _initCell({
			Code			: '',
			content			: content
		});
	}
		
	function _initCell(cell)
	{
		var ncell			= {
			Code			: cell.Code, // ВНИМАНИЕ! ВАЖНО ОБЕСПЕЧИТЬ ПОЛЕ CODE НА ПЕРВОМ МЕСТЕ ПРИ ОТПРАВКЕ НА СЕРВЕР!!!
			colspan			: cell.colspan,
			rowspan			: cell.rowspan,
			getData			: _getCellData,
			setData			: _setCellData
		};
		_copyData(cell, ncell);
		return ncell;
	}

	// this === cell in data.cells
	function _getCellData()
	{
		return _copyData(this, {});
	}
		
		// this === cell in data.cells
	function _setCellData(data)
	{
		var css				= this.cssclass;
		if(data == null)
			for(var m in this) //чистим объект
			{
				if(_EXCLUDE_PROPS[m]!=true && this.hasOwnProperty(m))
					this[m]		= "";
			}
		else
			_copyData(data, this);
		if(this._TD)
		{
			if(css)
				this._TD.removeClass(css);

			_fillTD(this._TD, this);
		}
	}

	function _fillTD(td, cell)
	{
		if(cell.Code)
		{
			td.html(_decodeHTML(cell.content))
				.removeClass('pagepart_placeholder');
			if(cell.cssclass)
				td.addClass(cell.cssclass);
		} else
		{
			td.html('Тут пока пусто').addClass('pagepart_placeholder');
		}
	}

	function _renewCoords(opt)
	{
		_visit(opt, function(r, c, num, cell)
		{
			try
			{
				cell.coords	= {
					t		: r,
					r		: c + ( cell.colspan > 1 ? cell.colspan - 1 : 0 ),
					b		: r + ( cell.rowspan > 1 ? cell.rowspan - 1 : 0 ),
					l		: c
				};
			}catch (e)
			{
				console.log(e);
			}
		});
	}

	function _optimizationTable(opt)
	{
		var cell, num;
		var cut					= false;
		var data				= opt.data;

		//по строкам
		for(var r = 0; r < data.matrix.length; r++)
		{
			cut = true;
			for(var c = 0; c < data.matrix[r].length; c++)
			{
				num			= data.matrix[r][c];
				cell		= data.cells[num];
				if(cell.rowspan > 1 && cell.coords && cell.coords.t === r)
				{
				} else
				{
					cut = false;
				}
			}
			if(cut)
			{
				_visit(opt,function(rr, c, num, cell)
				{
					if(rr === r)
					{
						cell.rowspan--;
					}
				});
				data.matrix.splice(r, 1);
				return _optimizationTable(opt);
			}
		}

		//по столбцам
		//TODO не обнаружено ошибок отрисовки
	}

	function _garbageCollector(opt)
	{
		var trueNums			= {};
		var data				= opt.data;
		//чистим неиспользуемые cells
		_visit(opt, function(r, c, num, cell)
			{
				trueNums[num] = true;
			});
		for(var num in data.cells)
		{
			if(!trueNums.hasOwnProperty(num))
			{
				delete data.cells[num];
			}
		}
	}

	function _newNum(opt)
	{
		var data				= opt.data;
		var num				= ''+( data.maxindex++);
		while(data.cells[num]!=null)
		{
			num				= ''+( data.maxindex++);
		}
		return num;
	}

	// /Сервис //
	function _openContextMenu(e, opt)
	{
		e.preventDefault();
		//взываем контекстное меню
		if($(e.target).closest('div').is('#circleContextMenu'))
			return; //кликнули по контекстному меню
		opt.ui.contextCircleMenu.show(e, opt);
		opt.initDrag		= false;		
		return;		
	}
	// Drag-события //
	function _mouseDown(e, opt)
	{
		//проверка на вызов контекстного меню или операции в нем
		if($(e.target).closest('div').is('#circleContextMenu'))
		{
			//кликнули по контекстному меню
			return;
		}

		if(e.ctrlKey && !opt.disableEdit) // click + CtrlKey
		{
			//взываем контекстное меню
			opt.ui.contextCircleMenu.show(e, opt);
			opt.initDrag		= false;
			return;
		}else
		{
			//скрываем контекстное меню
			if(!opt.ui.contextCircleMenu.isHidden()) //если был открыт, снова разрешаем выделение ячеек
				opt.initDrag		= false;
			opt.ui.contextCircleMenu.hide(e, opt);
		}

		//какая клавиша нажата
		if(e.which===3) //если правая - ничего не делаем, но выделяем ячейку, если ничего не выделено
		{
			if($.isEmptyObject(opt.data.aZone))
			{
				//выделяем ячейку
				var ci					= $(e.target).closest('td.item').data('cellIndex');
				_selectCells(opt, ci);				
			}			
			return;
		}

		//далее - обычный алгоритм работы
		if(opt.disableEdit)
			return;
		//отменяем выделение
		_unselectCells(opt);
		//выделяем ячейку
		var ci					= $(e.target).closest('td.item').data('cellIndex');
		_selectCells(opt, ci);

		//включаем режим выделения ячеек
		if(opt.initDrag)
		{
			return;
		}
		opt.initDrag			= true;
		_disableSelectText( opt.t, true );
	}

	function _mouseUp(e, opt)
	{
		opt.initDrag			= false;
		_disableSelectText( opt.t, false );

		//detect doubleClick only on right button
		if(e.which===3)
			return;
		var t = $(e.target).closest('td.item');
		if(!t)
			return;
		
		var selTime				= t.data('cellSelectedTime');
		var now					= (new Date).getTime();

		if(selTime && (now - selTime < 350 ))
			_cb(opt); //двойной клик был, открываем свойста ячейки
		else 
			t.data('cellSelectedTime', now)
	}

	function _mouseMove(e, opt)
	{
		if(opt.disableEdit)
			return;		
		if(opt.initDrag)
		{			
			var ci				= $(e.target).closest('td.item').data('cellIndex');
			if(opt.oCi != ci)
			{
				opt.oCi = ci;
				_selectCells(opt, ci);		
			}
		}
	}

	function _disableSelectText(container, val)
	{
		if(val)
		{
			container.attr( 'unselectable',	'on' )
						.css( 'user-select', 'none' )
						.on( 'selectstart',	false );
		}else
		{
			container.attr( 'unselectable', '' )
						.css( 'user-select', 'text' )
						.off( 'selectstart' );
		}
	}

	function _unselectCells(opt)
	{
		var	data				= opt.data;
		data.aZone			= {};
		_visit(opt, function(r, c, num, cell)
		{
			if(cell.toolSel)
			{
				delete cell.toolSel;
			}
		});
		if(data.toolSelRow != null)
		{
			delete data.toolSelRow;
		}
		if(data.toolSelCol != null)
		{
			delete data.toolSelCol;
		}
		//_renderActiveZone(opt); //вернуть, если будет реализовано отдельное действие "снять выделение"
	}

	function _selectCells(opt, num)
	{
		var data				= opt.data;
		var aZone				= data.aZone;
		var cell;
		var coords;
		var startPos			= opt.startPos;

		if(!opt.initDrag)
		{
			//только начинаем выделение, пришла start ячейка
			cell			= data.cells[num];
			coords			= cell.coords;

			aZone.t			= coords.t;
			aZone.r			= coords.r;
			aZone.b			= coords.b;
			aZone.l			= coords.l;

			startPos.t		= coords.t;
			startPos.r		= coords.r;
			startPos.b		= coords.b;
			startPos.l		= coords.l;
		}else
		{
			//уже выделяем, пришла end ячейка
			aZone.t			= startPos.t;
			aZone.r			= startPos.r;
			aZone.b			= startPos.b;
			aZone.l			= startPos.l;

			cell			= data.cells[num];
			coords			= cell.coords;

			if(coords.t < aZone.t)
			{
				aZone.t		= coords.t;
			}
			if(coords.r > aZone.r)
			{
				aZone.r		= coords.r;
			}
			if(coords.b > aZone.b)
			{
				aZone.b		= coords.b;
			}
			if(coords.l < aZone.l)
			{
				aZone.l		= coords.l;
			}
			_recalcActive(opt, aZone);
		}
		_renderActiveZone(opt); 
	}

	function _recalcActive(opt, z)
	{
		var data				= opt.data;
		var needRecalc			= false;
		var num;
		var cell;
		var cc;

		//проверяем ячейки и расширяем область, если они выходят за текущую
		for(var r = z.t; r <= z.b; r++)
		{
			for(var c = z.l; c <= z.r; c++)
			{
				num			= data.matrix[r][c];
				cell		= data.cells[num];
				cc			= cell.coords;

				if(cc.t < z.t)
				{
					z.t				= cc.t;
					needRecalc		= true;
				}
				if(cc.r > z.r)
				{
					z.r				= cc.r;
					needRecalc		= true;
				}
				if(cc.b > z.b)
				{
					z.b				= cc.b;
					needRecalc		= true;
				}
				if(cc.l < z.l)
				{
					z.l				= cc.l;
					needRecalc		= true;
				}

				if(needRecalc)
				{
					return _recalcActive(opt, z);
				}
			}
		}

	}

	function _selectCol(e, opt)
	{		
		if(opt.disableEdit)
			return;
		
		var data				= opt.data;
		var index;

		_unselectCells(opt);
		index					= $(e.target).data('selIndex');
		_visit(opt, function(r, c, num, cell)
		{
			if(cell.toolSel)
			{
				delete cell.toolSel;
			}
			var coords		= cell.coords;
			if(coords.l === index && coords.r === index)
			{
				cell.toolSel		= true; //TODO: мы не подсвечиваем столбцы, можно выпиливать весь этот блок...
			}
		});
		data.toolSelCol			= index;
		_renderActiveZone(opt);
	}

	function _selectRow(e, opt)
	{
		if(opt.disableEdit)
			return;
		var data				= opt.data;
		var index;
		_unselectCells(opt);
		index					= $(e.target).data('selIndex');
		_visit(opt, function(r, c, num, cell)
		{
			if(cell.toolSel)
			{
				delete cell.toolSel;
			}
			var coords		= cell.coords;
			if(coords.t === index && coords.b === index)
			{
				cell.toolSel		= true;
			}
		});
		data.toolSelRow		= index;
		_renderActiveZone(opt);
	}

	// /Drag-события //

	// Отрисовка //
	function _renderAll(opt)
	{
		if(opt.disableEdit)
			return;
		//корректировка данных
		_preRender(opt);
		//готовим начальный каркас для заполнения
		_renderFrame(opt);
		//обновляем toolbars
		_refreshToolbars(opt);
		//вставляем данные
		_renderDataCells(opt);
		//обновляем выделение
		_renderActiveCells(opt);
	}

	function _renderActiveZone(opt)
	{
		if(opt.disableEdit)
			return;
		
		_preRender(opt);
		_refreshToolbars(opt);
		_renderActiveCells(opt);

	}

	function _preRender(opt)
	{
		if(opt.disableEdit)
			return;			
		// проверяем наличие лишних rowspan (ломает отрисовку)
		_optimizationTable(opt);
		//убираем мусор
		_garbageCollector(opt);
		//пересчитываем координаты на всякий случай повторно
		_renewCoords(opt);		
	}

	function _renderFrame(opt)
	{
		var data				= opt.data,
			tt					= opt.t[0],
			tools				= opt.ui,
			trs					= [],
			tr1,tr2,
			r;

		if(opt.disableEdit)
			return;
		if(!tt)
			return;

		//чистим все
		while(tt.rows.length > 0) tt.deleteRow(0);	
		
		//строим каркас таблицы данных и инструментов
		tr1					= tt.insertRow(0);
		tr2					= tt.insertRow(1);
		for(r=2; r<data.matrix.length+2; r++)
			trs.push( tt.insertRow(r) ); //добавляем строки и одновременно записываем их в массив вставки индексов

		tr1.appendChild(tools.tdHorTabPrev[0]);		
		tools.tdHorTools
				.append( tools.spanL )
				.append( tools.spanR )
				.append( tools.spanDC );

		$(tr1).addClass('topTools');

		tr2.appendChild(tools.tdVerTabPrev[0]);
		tr2.appendChild(tools.tdSpacer[0]);
		tools.colIndexes.appendTo(tr2, data.matrix[0].length ); //добавляем индексы колонок		
		tools.rowIndexes.appendTo(trs); //добавляем индексы строк

		tools.tdVerTools
				.append( tools.spanT )
				.append( tools.spanB )
				.append( tools.spanDR );

	}

	function _refreshToolbars(opt)
	{
		var data				= opt.data,
			tt					= opt.t[0],
			tools				= opt.ui,
			tr1					= tt.rows[0],
			cw					= Math.round(100/data.matrix[0].length),
			horCheckStart		= null,
			horCheckEnd			= null,
			verCheckStart		= null,
			verCheckEnd			= null,
			d,n,c,r;

		if(opt.disableEdit)
			return;
		
		// horisontal ToolBar
		if(data.toolSelCol > -1 || data.aZone.l > -1)
		{
			horCheckStart		= (data.toolSelCol > -1 ? data.toolSelCol : data.aZone.l);
			horCheckEnd			= (data.toolSelCol > -1 ? data.toolSelCol : data.aZone.r);
		}
		if(horCheckStart !== null)
		{
			//вставляем элементы управления		
			tr1.appendChild(tools.tdHorTools[0]);			
			if(horCheckEnd < (data.matrix[0].length-1))
			{
				tr1.appendChild(tools.tdHorTabAfter[0]);
				tools.tdHorTabAfter[0].colSpan		=  data.matrix[0].length - horCheckEnd;
			}
			else
			{
				tools.tdHorTabAfter.detach();
			}

			tools.tdHorTools[0].colSpan			= horCheckEnd - horCheckStart + 1;
			tools.tdHorTabPrev[0].colSpan		= horCheckStart + 2;			

			if(!$.isEmptyObject(data.aZone))
			{
				tools.tdHorTools
					.append(tools.spanMERGE)
					.append(tools.spanUNMERGE);
			}else
			{
				tools.spanMERGE.detach();
				tools.spanUNMERGE.detach();				
			}

			if(!$.isEmptyObject(data.aZone) && opt.onEdit)
			{
				//если выбрана только одна ячейка, вставляем кнопку свойств
				d				= data.aZone;
				n				= data.matrix[ d.t ][ d.l ];
				c				= data.cells[n];

				if(
					((d.r === d.l) || (d.r === (d.l + c.colspan - 1))) &&
					((d.b === d.t) || (d.b === (d.t + c.rowspan - 1)))					
				)
				{
					tools.tdHorTools.append(tools.spanCELLOPT);					
				}else
				{
					tools.spanCELLOPT.detach();	
				}
			}else
			{
				tools.spanCELLOPT.detach();	
			}
		}else
		{
			//не выделены ячейки, скрываем элементы toolbar
			tools.tdHorTools.detach();
			tools.spanMERGE.detach();
			tools.spanUNMERGE.detach();
			tools.spanCELLOPT.detach();
			tools.tdHorTabAfter.detach();
			tools.tdHorTabPrev[0].colSpan		= data.matrix[0].length + 2;
		}
		// /horisontal ToolBar

		// vertical Toolbar
		if(data.toolSelRow > -1 || data.aZone.t > -1)
		{
			verCheckStart		= (data.toolSelRow > -1 ? data.toolSelRow : data.aZone.t);
			verCheckEnd			= (data.toolSelRow > -1 ? data.toolSelRow : data.aZone.b);
		}

		if(verCheckStart !== null)
		{
			//вставляем инструменты
			tools.tdVerTabPrev[0].rowSpan	= verCheckStart + 1;
			tools.tdVerTools[0].rowSpan	= verCheckEnd - verCheckStart + 1;
			tt.rows[verCheckStart+2].insertBefore(tools.tdVerTools[0], tt.rows[verCheckStart+2].firstChild);		
	
			if(verCheckEnd < (data.matrix.length-1))
			{
				tt.rows[verCheckEnd + 3].insertBefore(tools.tdVerTabAfter[0], tt.rows[verCheckEnd + 3].firstChild);
				tools.tdVerTabAfter[0].rowSpan	= data.matrix.length - verCheckEnd - 1 ;
			}else
			{
				tools.tdVerTabAfter.detach();
			}
		}else
		{	
			//не выделены ячейки, скрываем элементы toolbar
			tools.tdVerTools.detach();
			tools.tdVerTabAfter.detach();
			tools.tdVerTabPrev[0].rowSpan		= data.matrix.length + 1;
		}
		// /vertical Toolbar		

		// TolSelCol/TolSelRow
		for(c=2; c<tt.rows[1].cells.length; c++)
		{
			if(data.toolSelCol != null && c == data.toolSelCol + 2)
				$(tt.rows[1].cells[c]).addClass('toolSel');
			else
				$(tt.rows[1].cells[c]).removeClass('toolSel');
			$(tt.rows[1].cells[c]).css('width', cw  + '%');
		}
		for(r=2;r<tt.rows.length;r++)
		{
			c = 0;
			if(verCheckStart != null && (r==verCheckStart+2 || r==verCheckEnd+3))
				c = 1;
			if(data.toolSelRow != null && r == data.toolSelRow + 2)
				$(tt.rows[r].cells[c]).addClass('toolSel');
			else
				$(tt.rows[r].cells[c]).removeClass('toolSel');			
		}
		tools.contextCircleMenu.hide();
	}

	function _renderDataCells(opt)
	{
		var data				= opt.data,
			tt					= opt.t[0],			
			cw					= Math.round(100/data.matrix[0].length),
			tr, td, or			= null,
			c, r, n, d, i;

		if(opt.disableEdit)
			return;
		if(!tt)
			return;
			
		_visit(opt, function(r, c, num, cell)
		{
			if(or != (r+2)) //берем с отступом на 2 строки tools
			{
				tr = tt.rows[r+2] 
				or = r+2;
			}
			var td = _getTD(opt, num, cell, cw);
			tr.appendChild(td);
		});
	}

	function _renderActiveCells(opt)
	{
		var data				= opt.data,
			tt					= opt.t[0];

		_visit(opt, function(r, c, num, cell)
		{
			//входит в активную зону
			if(cell.coords.t >= data.aZone.t && 
				cell.coords.r <= data.aZone.r && 
				cell.coords.b <= data.aZone.b && 
				cell.coords.l >= data.aZone.l)
			{
				cell._TD.addClass('active');
			}else
			{
				cell._TD.removeClass('active');
			}
			if(cell.toolSel)
			{
				cell._TD.addClass('toolSel');
			}else
			{
				cell._TD.removeClass('toolSel');
			}
		});
	}

	// служебные поля

	function _getTD(opt, num, cell, cw)
	{
		var data				= opt.data;
		if(!cell._TD)
		{
			cell._TD		= $('<TD/>');
			cell._TD.addClass('item')
					.data('cellIndex', num);

			_fillTD(cell._TD, cell)
		}
		cell._TD.css('width', ( cell.colspan > 1 ? cell.colspan * cw : cw ) + '%');
		
		var td				= cell._TD[0];
		td.colSpan			= cell.colspan > 1 ? cell.colspan : 1;
		td.rowSpan			= cell.rowspan > 1 ? cell.rowspan : 1;

		cell._TD.attr('data-coords', JSON.stringify(cell.coords)); // TODO: ненужно - DEBUG
		return td;
	}

	function _colIndexTDs(opt)
	{
		var _TD					= [],
			lastIndex			= 0,
			i;
		
		this.appendTo			= _appendTo;

		function _appendTo(tr, count)
		{
			count				= count || 0;			
			while(_TD.length < count)
				_TD.push( _getSimpleTD({
						'data':['selIndex',lastIndex],
						'html' : ++lastIndex,
						'cssclass':'tool_row'
					})
				);
			for(i=0; i<count; i++)
				tr.appendChild(_TD[i][0]);
		}
	}

	function _rowIndexTDs(opt)
	{
		var _TD					= [],
			lastIndex			= 0,
			r;
		
		this.appendTo			= _appendTo;

		function _appendTo(trs)
		{
			count = trs.length || 0;
			while(_TD.length < count)
				_TD.push( _getSimpleTD({
						'data'		:['selIndex',lastIndex],
						'html'		: ++lastIndex,
						'cssclass'		: 'tool_col'						
					})
				);
			for(r=0; r<count; r++)
				trs[r].appendChild(_TD[r][0]);
		}	
	}

	function _getSimpleTD(prop)
	{	
		var	td;

		if(prop === undefined)
			return $("<TD/>");
			
		if(typeof(prop)=='string' || typeof(prop)=='number')
			prop = { html: prop };
		td						= $('<TD/>').html(prop.html);
		if(prop.cssclass) td.addClass(prop.cssclass);
		if(prop.data) td.data(prop.data[0], prop.data[1]);

		return td;
	}

	function contextCircleMenu(opt)
	{
		var cont,
			ui					= opt.ui,
			isHide				= true,
			data				= opt.data;
			_ui					= {
				spanMERGE		: ui.spanMERGE.clone(),
				spanUNMERGE		: ui.spanUNMERGE.clone(),
				spanDR			: ui.spanDR.clone(),
				spanDC			: ui.spanDC.clone(),
				spanCELLOPT		: ui.spanCELLOPT.clone(),
				spanCLSCONT		: $('<span class="closeContMenu icon-t close" title="Закрыть меню"/>'),
				spanCUT			: $('<span class="cellCut icon-t cut" title="Вырезать"/>'),
				spanCOPY		: $('<span class="cellCopy icon-t copy" title="Копировать"/>'),
				spanPASTE		: $('<span class="cellPaste icon-t paste" title="Вставить"/>')
			}
		cont					= $('<div id="circleContextMenu" class="toolbar"/>').hide();		

		this.show				= _show;
		this.hide				= _hide;
		this.isHidden			= _isHidden;
		function _show(e, opt)
		{
			var offset = $(e.target).closest('TD.item').offset(),
				relativeX = (e.pageX - offset.left),
				relativeY = (e.pageY - offset.top);
			//обновляем набор кнопок
			if($.isEmptyObject(data.aZone) || !_ALLOW_CONTEXT_MENU)
				return;
			cont.empty();
			cont
				.append(_ui.spanDR)
				.append(_ui.spanDC)
				.append(_ui.spanMERGE)
				.append(_ui.spanUNMERGE)
				.append(_ui.spanCLSCONT);
			if(!$.isEmptyObject(data.aZone) && opt.onEdit) //!проверка на onEdit не совсем корректна - тут по факту также отменяем cut,copy,paste (сделано для htmlEditor)
			{
				//если выбрана только одна ячейка, вставляем кнопку opt, copy, cut и paste (если возможно)
				d				= data.aZone;
				n				= data.matrix[ d.t ][ d.l ];
				c				= data.cells[n];

				if(
					((d.r === d.l) || (d.r === (d.l + c.colspan - 1))) &&
					((d.b === d.t) || (d.b === (d.t + c.rowspan - 1)))					
				)
				{
					cont.append(_ui.spanCELLOPT);
					if(!c._TD.hasClass('pagepart_placeholder'))
					{
						cont.append(_ui.spanCUT);
						cont.append(_ui.spanCOPY);
					}
					//вставляем кнопку paste, если выбран источник
					if(opt.clipboard.cellSource)
						cont.append(_ui.spanPASTE);
				}								
			}

			//вставляем в страницу
			$(e.target).append(cont);
			cont.css({'left':relativeX - cont.width()/2,'top':relativeY - cont.height()/2});
			isHide				= false;
			cont.show();
		}
		function _hide(e, opt)
		{
			cont.hide();
			isHide				= true;
		}
		function _isHidden()
		{
			return isHide;
		}
		function _decodeHTML(html)
		{
			return html
					.replace(/&gt;/g, '>')
					.replace(/&lt;/g, '<')
					.replace(/&amp;/g, '&');
		}		

	}

	//
})(jQuery);
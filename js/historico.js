 // Configuração do Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyByyM8RvGNM5pyrQIQ7nCH6mmgYAIpq0bc",
            authDomain: "rifas-c414b.firebaseapp.com",
            databaseURL: "https://rifas-c414b-default-rtdb.firebaseio.com",
            projectId: "rifas-c414b",
            storageBucket: "rifas-c414b.firebasestorage.app",
            messagingSenderId: "770195193538",
            appId: "1:770195193538:web:48e585ac5661d27f3dc55b"
        };
        
        // Inicializa o Firebase
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();

        document.addEventListener('DOMContentLoaded', function() {
            // Configura modais
            setupModals();
            
            // Carrega histórico
            carregarHistorico();
            
            // Configura botões
            document.getElementById('btnExportarHistorico').addEventListener('click', exportarParaPDF);
            document.getElementById('btnLimparHistorico').addEventListener('click', () => toggleModal('modalLimparHistorico', true));
            document.getElementById('btnConfirmarLimparHistorico').addEventListener('click', limparHistoricoCompleto);
            document.getElementById('btnFiltrar').addEventListener('click', aplicarFiltros);
            document.getElementById('btnLimparFiltro').addEventListener('click', limparFiltros);
            
            // Configura acessibilidade
            setupAccessibility();
        });

        let historicoCompleto = [];
        let pdfAtual = null;
        let encomendaAtual = null;
        
        function setupModals() {
            // Fechar modais ao clicar no overlay
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        toggleModal(this.id, false);
                    }
                });
            });
            
            // Fechar modais com ESC
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                        toggleModal(modal.id, false);
                    });
                }
            });
            
            // Botões de fechar
            document.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', function() {
                    const modalId = this.closest('.modal-overlay').id;
                    toggleModal(modalId, false);
                });
            });
        }
        
        function toggleModal(modalId, show) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            
            if (show) {
                modal.classList.add('active');
                // Focar no primeiro elemento interativo do modal
                const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focusable) focusable.focus();
            } else {
                modal.classList.remove('active');
            }
        }
        
        function setupAccessibility() {
            // Adiciona labels para elementos interativos
            document.querySelectorAll('[aria-label]').forEach(el => {
                if (!el.id) {
                    el.id = 'label-' + Math.random().toString(36).substr(2, 9);
                }
            });
            
            // Gerencia foco para acessibilidade
            document.addEventListener('focus', function(e) {
                if (e.target.matches('[data-focus-visible-added]')) {
                    e.target.setAttribute('data-focus-visible-added', 'true');
                }
            }, true);
        }
        
        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast';
            
            // Adiciona classe de tipo se necessário
            if (type === 'error') {
                toast.style.backgroundColor = 'var(--md-sys-color-error)';
                toast.style.color = 'var(--md-sys-color-on-error)';
            } else if (type === 'success') {
                toast.style.backgroundColor = 'var(--md-sys-color-primary)';
                toast.style.color = 'var(--md-sys-color-on-primary)';
            }
            
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
        
        async function carregarHistorico() {
            try {
                // Mostrar estado de carregamento
                const tabelaHistorico = document.getElementById('tabelaHistorico');
                tabelaHistorico.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="empty-state">
                                <span class="loading" aria-hidden="true"></span>
                                <p>Carregando histórico...</p>
                            </div>
                        </td>
                    </tr>
                `;
                
                // Carrega todas as encomendas (não apenas o histórico)
                const snapshot = await database.ref('encomendas').once('value');
                
                if (!snapshot.exists()) {
                    tabelaHistorico.innerHTML = `
                        <tr>
                            <td colspan="7">
                                <div class="empty-state">
                                    <i class="material-icons">history</i>
                                    <p>Nenhum registro no histórico</p>
                                </div>
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                // Converte para array e processa os dados
                historicoCompleto = [];
                snapshot.forEach(child => {
                    const encomenda = child.val();
                    historicoCompleto.push({
                        id: child.key,
                        data: encomenda.data,
                        blocoApto: encomenda.blocoApto,
                        quantidade: encomenda.quantidade,
                        detalhes: encomenda.descricao || 'Sem detalhes',
                        porteiroNome: encomenda.registradoPorNome || 'Porteiro',
                        retiradoPor: encomenda.retiradoPorNome || (encomenda.status === 'retirado' ? 'Morador' : null),
                        status: encomenda.status,
                        dataRetirada: encomenda.dataRetirada || null,
                        porteiroRetirada: encomenda.porteiroRetiradaNome || null
                    });
                });
                
                // Ordena por data (mais recente primeiro)
                historicoCompleto.sort((a, b) => b.data - a.data);
                atualizarTabela(historicoCompleto);
                
            } catch (error) {
                console.error('Erro ao carregar histórico:', error);
                showToast('Erro ao carregar histórico', 'error');
            }
        }
        
        function atualizarTabela(dados) {
            const tabelaHistorico = document.getElementById('tabelaHistorico');
            
            if (dados.length === 0) {
                tabelaHistorico.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="empty-state">
                                <i class="material-icons">search</i>
                                <p>Nenhum registro encontrado</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            tabelaHistorico.innerHTML = '';
            dados.forEach(item => {
                const tr = document.createElement('tr');
                
                // Para mobile, adicionamos data-labels
                tr.innerHTML = `
                    <td data-label="Data">${formatarData(item.data)}</td>
                    <td data-label="Bloco/Apto">${item.blocoApto}</td>
                    <td data-label="Detalhes">
                        <strong>${item.quantidade} item(s)</strong><br>
                        ${item.detalhes}
                    </td>
                    <td data-label="Porteiro">${item.porteiroNome}</td>
                    <td data-label="Retirado por">${item.retiradoPor || 'N/A'}</td>
                    <td data-label="Status">
                        <span class="badge ${item.status === 'pendente' ? 'error' : 'primary'}">
                            ${item.status === 'pendente' ? 'Pendente' : 'Retirado'}
                        </span>
                    </td>
                    <td data-label="Ações" class="table-actions">
                        <button class="btn btn-text" onclick="compartilharEncomenda('${item.id}')" aria-label="Compartilhar encomenda">
                            <i class="material-icons">share</i>
                        </button>
                        <button class="btn btn-text" onclick="exportarItemPDF('${item.id}')" aria-label="Exportar para PDF">
                            <i class="material-icons">picture_as_pdf</i>
                        </button>
                    </td>
                `;
                tabelaHistorico.appendChild(tr);
            });
        }
        
        function formatarData(timestamp) {
            if (!timestamp) return 'N/A';
            const date = new Date(timestamp);
            return date.toLocaleString('pt-BR');
        }
        
        function aplicarFiltros() {
            const filtroBloco = document.getElementById('filtroBloco').value.toLowerCase();
            const filtroApto = document.getElementById('filtroApto').value.toLowerCase();
            
            const dadosFiltrados = historicoCompleto.filter(item => {
                const blocoApto = item.blocoApto.toLowerCase();
                const blocoMatch = !filtroBloco || blocoApto.includes(filtroBloco.toLowerCase());
                const aptoMatch = !filtroApto || blocoApto.includes(filtroApto.toLowerCase());
                return blocoMatch && aptoMatch;
            });
            
            atualizarTabela(dadosFiltrados);
        }
        
        function limparFiltros() {
            document.getElementById('filtroBloco').value = '';
            document.getElementById('filtroApto').value = '';
            atualizarTabela(historicoCompleto);
        }
        
        async function limparHistoricoCompleto() {
            try {
                // Mostrar estado de carregamento
                const btn = document.getElementById('btnConfirmarLimparHistorico');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<span class="loading" aria-hidden="true"></span> Processando...';
                btn.disabled = true;
                
                // Primeiro, obtemos todas as encomendas
                const snapshot = await database.ref('encomendas').once('value');
                
                if (!snapshot.exists()) {
                    showToast('Nenhuma encomenda encontrada', 'info');
                    return;
                }
                
                // Criamos um array de promessas para deletar as encomendas finalizadas
                const promises = [];
                
                snapshot.forEach(child => {
                    const encomenda = child.val();
                    // Verifica se o status é "entregue" ou "finalizada" (ou qualquer status que você considerar como finalizado)
                    if (encomenda.status === 'retirado' || encomenda.status === 'entregue' || encomenda.status === 'finalizada') {
                        promises.push(database.ref('encomendas/' + child.key).remove());
                    }
                });
                
                // Executa todas as promessas
                await Promise.all(promises);
                
                showToast('Encomendas finalizadas removidas com sucesso', 'success');
                
                // Recarrega os dados
                await carregarHistorico();
                
                toggleModal('modalLimparHistorico', false);
                
            } catch (error) {
                console.error('Erro ao limpar encomendas finalizadas:', error);
                showToast('Erro ao limpar encomendas finalizadas', 'error');
            } finally {
                const btn = document.getElementById('btnConfirmarLimparHistorico');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
        
        function compartilharEncomenda(id) {
            encomendaAtual = historicoCompleto.find(item => item.id === id);
            if (!encomendaAtual) return;
            
            // Gera o PDF primeiro
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Título
            doc.setFontSize(18);
            doc.text('Detalhes da Encomenda', 105, 15, { align: 'center' });
            
            // Data de emissão
            doc.setFontSize(10);
            doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 105, 22, { align: 'center' });
            
            // Detalhes
            doc.setFontSize(12);
            let y = 40;
            
            doc.text(`Bloco/Apartamento: ${encomendaAtual.blocoApto}`, 15, y);
            y += 10;
            doc.text(`Data do Registro: ${formatarData(encomendaAtual.data)}`, 15, y);
            y += 10;
            doc.text(`Quantidade: ${encomendaAtual.quantidade}`, 15, y);
            y += 10;
            doc.text(`Registrado por: ${encomendaAtual.porteiroNome}`, 15, y);
            y += 10;
            doc.text(`Retirado por: ${encomendaAtual.retiradoPor || 'N/A'}`, 15, y);
            y += 10;
            doc.text(`Status: ${encomendaAtual.status === 'pendente' ? 'Pendente' : 'Retirado'}`, 15, y);
            y += 15;
            
            // Detalhes adicionais
            doc.setFontSize(14);
            doc.text('Detalhes da Encomenda:', 15, y);
            y += 10;
            doc.setFontSize(12);
            const detalhes = doc.splitTextToSize(encomendaAtual.detalhes || 'Nenhum detalhe adicional fornecido', 180);
            doc.text(detalhes, 15, y);
            
            // Converte para blob
            const pdfBlob = doc.output('blob');
            pdfAtual = pdfBlob;
            
            // Mostra o modal
            document.getElementById('detalhesCompartilhar').innerHTML = `
                <p><strong>Bloco/Apto:</strong> ${encomendaAtual.blocoApto}</p>
                <p><strong>Data:</strong> ${formatarData(encomendaAtual.data)}</p>
                <p><strong>Quantidade:</strong> ${encomendaAtual.quantidade}</p>
                <p><strong>Detalhes:</strong> ${encomendaAtual.detalhes}</p>
            `;
            
            toggleModal('modalCompartilhar', true);
        }

        // Funções de compartilhamento
        function compartilharViaWhatsApp() {
            if (!encomendaAtual) return;
            
            const text = `Detalhes da encomenda para ${encomendaAtual.blocoApto}:\n` +
                         `Data: ${formatarData(encomendaAtual.data)}\n` +
                         `Quantidade: ${encomendaAtual.quantidade}\n` +
                         `Detalhes: ${encomendaAtual.detalhes}`;
            
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        }

        function compartilharViaTelegram() {
            if (!encomendaAtual) return;
            
            const text = `Detalhes da encomenda para ${encomendaAtual.blocoApto}:\n` +
                         `Data: ${formatarData(encomendaAtual.data)}\n` +
                         `Quantidade: ${encomendaAtual.quantidade}\n` +
                         `Detalhes: ${encomendaAtual.detalhes}`;
            
            const url = `https://t.me/share/url?url=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        }

        function compartilharViaEmail() {
            if (!encomendaAtual) return;
            
            const subject = `Encomenda para ${encomendaAtual.blocoApto}`;
            const body = `Detalhes da encomenda:\n\n` +
                         `Bloco/Apartamento: ${encomendaAtual.blocoApto}\n` +
                         `Data: ${formatarData(encomendaAtual.data)}\n` +
                         `Quantidade: ${encomendaAtual.quantidade}\n` +
                         `Detalhes: ${encomendaAtual.detalhes}`;
            
            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }

        function compartilharViaOutros() {
            if (!pdfAtual) return;
            
            // Cria um link temporário para o PDF
            const pdfUrl = URL.createObjectURL(pdfAtual);
            const fileName = `Encomenda_${encomendaAtual.blocoApto}.pdf`;
            
            // Cria um link <a> temporário para download
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Libera o objeto URL
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
            
            showToast('PDF pronto para compartilhamento', 'success');
        }
        
        function exportarItemPDF(id) {
            const encomenda = historicoCompleto.find(item => item.id === id);
            if (!encomenda) return;
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Título
            doc.setFontSize(18);
            doc.text('Detalhes da Encomenda', 105, 15, { align: 'center' });
            
            // Data de emissão
            doc.setFontSize(10);
            doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 105, 22, { align: 'center' });
            
            // Detalhes
            doc.setFontSize(12);
            let y = 40;
            
            doc.text(`Bloco/Apartamento: ${encomenda.blocoApto}`, 15, y);
            y += 10;
            doc.text(`Data do Registro: ${formatarData(encomenda.data)}`, 15, y);
            y += 10;
            doc.text(`Quantidade: ${encomenda.quantidade}`, 15, y);
            y += 10;
            doc.text(`Registrado por: ${encomenda.porteiroNome}`, 15, y);
            y += 10;
            doc.text(`Retirado por: ${encomenda.retiradoPor || 'N/A'}`, 15, y);
            y += 10;
            doc.text(`Status: ${encomenda.status === 'pendente' ? 'Pendente' : 'Retirado'}`, 15, y);
            y += 15;
            
            // Detalhes adicionais
            doc.setFontSize(14);
            doc.text('Detalhes da Encomenda:', 15, y);
            y += 10;
            doc.setFontSize(12);
            const detalhes = doc.splitTextToSize(encomenda.detalhes || 'Nenhum detalhe adicional fornecido', 180);
            doc.text(detalhes, 15, y);
            
            // Salva o PDF
            doc.save(`encomenda_${encomenda.blocoApto}_${encomenda.id}.pdf`);
            showToast('PDF gerado com sucesso', 'success');
        }
        
        async function exportarParaPDF() {
            try {
                // Mostrar estado de carregamento
                const btn = document.getElementById('btnExportarHistorico');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<span class="loading" aria-hidden="true"></span> Gerando...';
                btn.disabled = true;
                
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Título
                doc.setFontSize(18);
                doc.text('Histórico Completo de Encomendas', 105, 15, { align: 'center' });
                
                // Data de emissão
                doc.setFontSize(10);
                doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 105, 22, { align: 'center' });
                
                // Filtros aplicados
                const filtroBloco = document.getElementById('filtroBloco').value;
                const filtroApto = document.getElementById('filtroApto').value;
                
                if (filtroBloco || filtroApto) {
                    doc.setFontSize(10);
                    doc.text(`Filtros aplicados: ${filtroBloco ? 'Bloco: ' + filtroBloco : ''} ${filtroApto ? 'Apto: ' + filtroApto : ''}`, 
                            105, 30, { align: 'center' });
                }
                
                // Cabeçalho da tabela
                const headers = [
                    ['Data', 'Bloco/Apto', 'Quantidade', 'Porteiro', 'Retirado por', 'Status']
                ];
                
                // Dados da tabela
                const dados = historicoCompleto
                    .filter(item => {
                        const blocoApto = item.blocoApto.toLowerCase();
                        const blocoMatch = !filtroBloco || blocoApto.includes(filtroBloco.toLowerCase());
                        const aptoMatch = !filtroApto || blocoApto.includes(filtroApto.toLowerCase());
                        return blocoMatch && aptoMatch;
                    })
                    .map(item => [
                        formatarData(item.data),
                        item.blocoApto,
                        item.quantidade.toString(),
                        item.porteiroNome,
                        item.retiradoPor || 'N/A',
                        item.status === 'pendente' ? 'Pendente' : 'Retirado'
                    ]);
                
                // Configurações da tabela
                const tableConfig = {
                    startY: 40,
                    head: headers,
                    body: dados,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [103, 80, 164], // Cor primária MD3
                        textColor: 255,
                        fontStyle: 'bold'
                    },
                    alternateRowStyles: {
                        fillColor: [245, 245, 245]
                    },
                    margin: { top: 40 }
                };
                
                // Adiciona a tabela
                doc.autoTable(tableConfig);
                
                // Salva o PDF
                doc.save('historico_encomendas.pdf');
                showToast('PDF gerado com sucesso', 'success');
                
            } catch (error) {
                console.error('Erro ao exportar para PDF:', error);
                showToast('Erro ao gerar PDF', 'error');
            } finally {
                const btn = document.getElementById('btnExportarHistorico');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
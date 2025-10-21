// ---------------------------
// Supabase 클라이언트 초기화 및 설정 (index.html에서 설정됨)
// ---------------------------
// window.supabase 객체는 index.html의 <script> 태그에서 이미 생성되어 있어야 합니다.

const TABLE_NAME = 'reservations'; // Supabase에 생성한 테이블 이름

// ---------------------------
// 예약 데이터 및 전역 상태
// ---------------------------
let reservations = []; // Supabase에서 데이터를 비동기적으로 로드할 예정
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let editingReservationId = null;

// 일별 화면에 표시할 시간 슬롯(시작시간 기준)
const DAY_SLOTS = ["10:00","11:00","12:00","13:00","14:00","15:00","16:00"];

// 현재 선택된 날짜(YYYY-MM-DD). 달력 렌더 직후 기본값을 세팅.
let selectedDate = null;

// =======================================================
// 🌐 Supabase 데이터 연동 함수 (CRUD)
// =======================================================

/**
 * Supabase에서 모든 예약 데이터를 불러와 전역 변수에 저장합니다.
 */
async function fetchReservations() {
    try {
        // created_at 기준으로 정렬하여 가져옴
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) throw error;

        reservations = data || [];
        console.log("Supabase에서 예약 데이터 로드 완료:", reservations.length);
        
        // 데이터 로드 후 화면을 다시 렌더링
        renderCalendar();
        updateTodayReservations();
        updateRecentReservations();
        if (selectedDate) {
            renderDaySchedule(selectedDate);
        } else {
            selectDefaultDateAfterRender();
        }

    } catch (error) {
        console.error("예약 데이터를 불러오는 중 오류 발생:", error.message);
        alert("예약 데이터를 불러오는 데 실패했습니다. 콘솔을 확인해주세요.");
    }
}

/**
 * 새로운 예약을 Supabase에 저장하거나 기존 예약을 업데이트합니다.
 * @param {object} reservationData - 저장할 예약 객체 (id 포함 가능)
 */
async function saveReservation(reservationData) {
    let result;
    try {
        if (reservationData.id) {
            // 수정 모드: UPDATE
            result = await supabase
                .from(TABLE_NAME)
                .update(reservationData)
                .eq('id', reservationData.id)
                .select();
            
            if (result.error) throw result.error;
            alert('예약이 성공적으로 수정되었습니다.');
        } else {
            // 새로 만들기 모드: INSERT
            // 고유 ID는 Supabase에서 자동으로 생성되므로 여기서는 제외함
            delete reservationData.id; 
            result = await supabase
                .from(TABLE_NAME)
                .insert([reservationData])
                .select(); 

            if (result.error) throw result.error;
            alert('새 예약이 성공적으로 저장되었습니다.');
        }

        closeModal();
        await fetchReservations(); // 데이터 업데이트 후 다시 로드 및 렌더링

    } catch (error) {
        console.error("예약 저장/수정 중 오류 발생:", error.message);
        alert(`예약 저장/수정 실패: ${error.message}`);
    }
}

/**
 * Supabase에서 예약을 삭제합니다.
 * @param {string} id - 삭제할 예약의 ID
 */
async function deleteReservation(id) {
    if (!confirm('정말로 이 예약을 삭제하시겠습니까?')) return;
    
    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', id);

        if (error) throw error;

        closeModal();
        closeDetailModal();
        alert('예약이 성공적으로 삭제되었습니다.');
        await fetchReservations(); // 데이터 업데이트 후 다시 로드 및 렌더링

    } catch (error) {
        console.error("예약 삭제 중 오류 발생:", error.message);
        alert(`예약 삭제 실패: ${error.message}`);
    }
}


// =======================================================
// ⚙️ 초기화 및 이벤트 리스너 (기존 로직 유지)
// =======================================================

document.addEventListener('DOMContentLoaded', function () {
    // Supabase에서 데이터를 먼저 로드합니다.
    fetchReservations(); 

    initializeYearSelect();
    initializeMonthSelect();
    // renderCalendar();            // fetchReservations 내부에서 호출됨
    // updateTodayReservations();   // fetchReservations 내부에서 호출됨
    // updateRecentReservations();  // fetchReservations 내부에서 호출됨

    // 이벤트 리스너
    document.getElementById('yearSelect').addEventListener('change', onYearChange);
    document.getElementById('monthSelect').addEventListener('change', onMonthChange);
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    document.getElementById('newReservationBtn').addEventListener('click', () => openNewReservationModal(selectedDate));
    
    // 모달 폼 제출 이벤트
    document.getElementById('reservationForm').addEventListener('submit', onSubmitReservation);

    // 모달 삭제 버튼 이벤트
    document.getElementById('deleteBtn').addEventListener('click', () => {
        if (editingReservationId) {
            deleteReservation(editingReservationId);
        }
    });
});

// =======================================================
// 📅 달력 및 화면 렌더링 함수 (기존 로직 유지)
// =======================================================

function initializeYearSelect() { /* ... (기존 코드 유지) ... */ }
function initializeMonthSelect() { /* ... (기존 코드 유지) ... */ }
function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendarEl.innerHTML = '';

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0=일, 6=토
    const daysInMonth = lastDayOfMonth.getDate();

    // 요일 헤더
    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    daysOfWeek.forEach(day => {
        const el = document.createElement('div');
        el.className = 'calendar-day-header';
        if (day === '일') el.style.color = 'red';
        if (day === '토') el.style.color = 'blue';
        el.textContent = day;
        calendarEl.appendChild(el);
    });

    // 시작 공백
    for (let i = 0; i < startDayOfWeek; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-date empty';
        calendarEl.appendChild(el);
    }

    // 날짜
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
        
        const el = document.createElement('div');
        el.className = 'calendar-date';
        el.innerHTML = `<span class="day-number">${day}</span>`;
        if (dayOfWeek === 0) el.classList.add('sunday');
        if (dayOfWeek === 6) el.classList.add('saturday');

        // 예약 표시
        const dailyReservations = reservations.filter(r => r.date === dateStr);
        if (dailyReservations.length > 0) {
            const countEl = document.createElement('div');
            countEl.className = 'reservation-count';
            countEl.textContent = `${dailyReservations.length}건`;
            el.appendChild(countEl);
        }

        // 오늘 날짜 표시
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (dateStr === todayStr) {
            el.classList.add('today');
        }

        // 선택된 날짜 표시
        if (dateStr === selectedDate) {
            el.classList.add('selected');
        }

        // 클릭 이벤트
        el.onclick = () => onDateClick(dateStr, el);

        calendarEl.appendChild(el);
    }
}

function selectDefaultDateAfterRender() {
    // 캘린더 렌더링 후 오늘 날짜를 기본으로 선택
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 현재 달력에 오늘 날짜가 있는지 확인
    if (today.getFullYear() === currentYear && today.getMonth() === currentMonth) {
        onDateClick(todayStr); // 오늘 날짜를 선택 (onDateClick이 렌더링도 처리함)
    } else if (reservations.length > 0) {
        // 예약이 있으면 가장 최근 예약을 선택
        onDateClick(reservations[0].date); 
    } else {
        // 예약이 없으면 현재 달의 1일을 선택
        const firstDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        onDateClick(firstDayStr);
    }
}

function onDateClick(dateStr) {
    // 이전에 선택된 날짜의 클래스를 제거
    document.querySelectorAll('.calendar-date.selected').forEach(el => el.classList.remove('selected'));

    // 새로운 날짜 선택 및 클래스 추가
    selectedDate = dateStr;
    const selectedEl = document.querySelector(`.calendar-date:has(.day-number:contains("${new Date(dateStr).getDate()}"))`);
    if (selectedEl) {
        selectedEl.classList.add('selected');
    }
    
    // 일별 일정 렌더링
    renderDaySchedule(dateStr);
}


// =======================================================
// 폼 및 모달 관련 함수 (기존 로직 유지)
// =======================================================

function openNewReservationModal(dateStr) {
    editingReservationId = null;
    document.getElementById('modalTitle').textContent = '새 예약 등록';
    document.getElementById('reservationForm').reset();
    document.getElementById('deleteBtn').style.display = 'none';

    // 날짜 자동 설정
    if (dateStr) {
        document.getElementById('reservationDate').value = dateStr;
    }
    document.getElementById('reservationModal').style.display = 'block';
}

function openEditReservationModal(reservation) {
    editingReservationId = reservation.id;
    document.getElementById('modalTitle').textContent = '예약 수정';
    
    // 폼에 데이터 채우기
    document.getElementById('contractorName').value = reservation.contractorName;
    document.getElementById('deceasedName').value = reservation.deceasedName;
    document.getElementById('reservationDate').value = reservation.date;
    document.getElementById('reservationTime').value = reservation.time;
    document.getElementById('staffName').value = reservation.staffName;

    document.getElementById('deleteBtn').style.display = 'inline-block';
    document.getElementById('reservationModal').style.display = 'block';
    closeDetailModal(); // 상세 모달이 열려있으면 닫기
}

function closeModal() {
    document.getElementById('reservationModal').style.display = 'none';
    document.getElementById('reservationForm').reset();
    editingReservationId = null;
}

function onSubmitReservation(event) {
    event.preventDefault();
    
    // 폼 데이터 수집
    const reservationData = {
        contractorName: document.getElementById('contractorName').value,
        deceasedName: document.getElementById('deceasedName').value,
        date: document.getElementById('reservationDate').value,
        time: document.getElementById('reservationTime').value,
        staffName: document.getElementById('staffName').value,
    };
    
    // 수정 모드인 경우 ID 추가
    if (editingReservationId) {
        reservationData.id = editingReservationId;
    }

    // Supabase 저장 함수 호출
    saveReservation(reservationData);
}

function showReservationDetail(reservation) {
    const detailsEl = document.getElementById('reservationDetails');
    detailsEl.innerHTML = `
        <p><strong>계약자명:</strong> ${reservation.contractorName}</p>
        <p><strong>고인명:</strong> ${reservation.deceasedName}</p>
        <p><strong>예약 일자:</strong> ${reservation.date}</p>
        <p><strong>예약 시간:</strong> ${reservation.time} - ${parseInt(reservation.time) + 1}:00</p>
        <p><strong>담당 직원:</strong> ${reservation.staffName}</p>
    `;

    // 수정 버튼에 현재 예약 정보 연결
    document.querySelector('#detailModal .btn-primary').onclick = () => openEditReservationModal(reservation);
    document.getElementById('detailModal').style.display = 'block';
}

function closeDetailModal() {
    document.getElementById('detailModal').style.display = 'none';
}


// =======================================================
// 사이드바 및 컨트롤 함수 (기존 로직 유지)
// =======================================================

function updateTodayReservations() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayList = document.getElementById('todayList');
    
    const todayReservations = reservations
        .filter(r => r.date === todayStr)
        .sort((a, b) => a.time.localeCompare(b.time));

    todayList.innerHTML = '';

    if (todayReservations.length === 0) {
        todayList.textContent = '오늘 예약된 일정이 없습니다.';
        return;
    }

    todayReservations.forEach(r => {
        const item = document.createElement('div');
        item.className = 'reservation-item';
        item.textContent = `[${r.time}] ${r.deceasedName} (${r.contractorName})`;
        item.onclick = () => showReservationDetail(r);
        todayList.appendChild(item);
    });
}

function updateRecentReservations() {
    const recentList = document.getElementById('recentList');
    
    // 최근 5개 예약 (시간 순, 최신 날짜 우선)
    const recentReservations = [...reservations] // 복사
        .sort((a, b) => {
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date); // 최신 날짜 우선
            }
            return b.time.localeCompare(a.time); // 같은 날짜면 늦은 시간 우선
        })
        .slice(0, 5);

    recentList.innerHTML = '';

    if (recentReservations.length === 0) {
        recentList.textContent = '등록된 예약이 없습니다.';
        return;
    }

    recentReservations.forEach(r => {
        const item = document.createElement('div');
        item.className = 'reservation-item';
        item.textContent = `[${r.date}] ${r.deceasedName} (${r.contractorName})`;
        item.onclick = () => showReservationDetail(r);
        recentList.appendChild(item);
    });
}

// 일별(시간대) 화면
function renderDaySchedule(dateStr) {
	const title = document.getElementById('dayScheduleTitle');
	const list = document.getElementById('dayScheduleList');
	if (!title || !list) return;

	title.textContent = `${dateStr} 일정`;
	list.innerHTML = '';

	const dayReservations = reservations
		.filter(r => r.date === dateStr)
		.reduce((map, r) => { map[r.time] = r; return map; }, {});

	DAY_SLOTS.forEach(time => {
		const row = document.createElement('div');
		row.className = 'slot-row';

		const timeEl = document.createElement('div');
		timeEl.className = 'slot-time';
		timeEl.textContent = `${time} - ${parseInt(time) + 1}:00`;

		const contentEl = document.createElement('div');
        contentEl.className = 'slot-content';

		if (dayReservations[time]) {
			const r = dayReservations[time];
			const booked = document.createElement('div');
			booked.className = 'slot-booked';
			booked.textContent = `예약 중: ${r.deceasedName} (계약자 ${r.contractorName})`;
			booked.onclick = () => showReservationDetail(r);
			contentEl.appendChild(booked);
		} else {
			const avail = document.createElement('div');
			avail.className = 'slot-available';
			avail.textContent = '예약 가능';
            avail.onclick = () => openNewReservationModal(dateStr); // 클릭 시 새 예약 모달 열기
			contentEl.appendChild(avail);
		}
        
        row.appendChild(timeEl);
        row.appendChild(contentEl);
		list.appendChild(row);
	});
}

function onYearChange() {
    currentYear = parseInt(document.getElementById('yearSelect').value);
    renderCalendar();
    selectDefaultDateAfterRender();
}

function onMonthChange() {
    currentMonth = parseInt(document.getElementById('monthSelect').value);
    renderCalendar();
    selectDefaultDateAfterRender();
}

function goToToday() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    
    document.getElementById('yearSelect').value = currentYear;
    document.getElementById('monthSelect').value = currentMonth;
    
    renderCalendar();
    const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onDateClick(todayStr); // 오늘 날짜를 선택
}